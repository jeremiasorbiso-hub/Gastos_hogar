'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { miembroActual } from '@/lib/supabase/server';
import { sincronizarTodo } from '@/lib/sync/sincronizar';
import { hoyAR, periodo, patronDe } from '@/lib/format';

async function exigirMiembro() {
  const { supabase, miembro } = await miembroActual();
  if (!miembro) throw new Error('No tenés acceso a este hogar');
  return { supabase, miembro };
}

function numero(v) {
  if (v == null) return NaN;
  let s = String(v).trim().replace(/[^\d,.\-]/g, '');
  // formato argentino: 1.234,56
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}

function listo() {
  revalidatePath('/', 'layout');
  return { ok: true };
}

// ---------------- Movimientos ----------------
export async function agregarMovimiento(fd) {
  const { supabase, miembro } = await exigirMiembro();
  const tipo = fd.get('tipo');
  const monto = Math.abs(numero(fd.get('monto')));
  if (!monto) return { error: 'Poné un monto válido' };
  const categoria = tipo === 'ingreso' ? 'Ingreso' : (fd.get('categoria') || 'Otros');
  const { error } = await supabase.from('movimientos').insert({
    descripcion: String(fd.get('descripcion') || '').trim() || categoria,
    monto: tipo === 'ingreso' ? monto : -monto,
    categoria,
    cuenta_id: fd.get('cuenta_id') || null,
    fecha: fd.get('fecha') || hoyAR().iso,
    cargado_por: fd.get('cargado_por') || miembro.email,
    origen: 'manual',
  });
  if (error) return { error: error.message };
  return listo();
}

export async function recategorizar({ id, categoria, aplicarATodos }) {
  const { supabase } = await exigirMiembro();
  const { data: mov, error } = await supabase.from('movimientos').update({ categoria }).eq('id', id).select('descripcion').single();
  if (error) return { error: error.message };
  if (aplicarATodos) {
    const patron = patronDe(mov.descripcion);
    if (patron.length >= 3) {
      await supabase.from('reglas').upsert({ patron, categoria });
      await supabase.from('movimientos').update({ categoria }).ilike('descripcion', `%${patron}%`);
    }
  }
  return listo();
}

export async function borrarMovimiento(id) {
  const { supabase } = await exigirMiembro();
  const { error } = await supabase.from('movimientos').delete().eq('id', id).eq('origen', 'manual');
  if (error) return { error: error.message };
  return listo();
}

// ---------------- Cuentas ----------------
export async function saldoManual(fd) {
  const { supabase } = await exigirMiembro();
  const saldo = numero(fd.get('saldo'));
  if (Number.isNaN(saldo)) return { error: 'Saldo inválido' };
  const { error } = await supabase.from('cuentas')
    .update({ saldo, actualizado_at: new Date().toISOString() })
    .eq('id', fd.get('cuenta_id'));
  if (error) return { error: error.message };
  return listo();
}

export async function sincronizarAhora() {
  await exigirMiembro();
  try {
    const r = await sincronizarTodo();
    revalidatePath('/', 'layout');
    const errores = r.resultados.filter((x) => x.error).map((x) => `${x.origen}: ${x.error}`);
    return { ok: errores.length === 0, errores, nuevos: r.resultados.reduce((a, x) => a + (x.nuevos || 0), 0) };
  } catch (e) {
    return { ok: false, errores: [String(e.message || e)] };
  }
}

// ---------------- Gastos fijos ----------------
export async function marcarFijo({ fijo_id, pagado }) {
  const { supabase } = await exigirMiembro();
  const h = hoyAR();
  const per = periodo(h.y, h.m);
  const q = pagado
    ? supabase.from('fijos_pagos').upsert({ fijo_id, periodo: per, auto: false })
    : supabase.from('fijos_pagos').delete().eq('fijo_id', fijo_id).eq('periodo', per);
  const { error } = await q;
  if (error) return { error: error.message };
  return listo();
}

export async function guardarFijo(fd) {
  const { supabase } = await exigirMiembro();
  const monto = Math.abs(numero(fd.get('monto')));
  const dia = Math.min(31, Math.max(1, parseInt(fd.get('dia'), 10) || 1));
  if (!fd.get('nombre') || !monto) return { error: 'Completá nombre y monto' };
  const fila = {
    nombre: String(fd.get('nombre')).trim(),
    dia,
    monto,
    patron: String(fd.get('patron') || '').trim().toLowerCase() || null,
  };
  const id = fd.get('id');
  const { error } = id
    ? await supabase.from('fijos').update(fila).eq('id', id)
    : await supabase.from('fijos').insert(fila);
  if (error) return { error: error.message };
  return listo();
}

export async function borrarFijo(id) {
  const { supabase } = await exigirMiembro();
  const { error } = await supabase.from('fijos').update({ activo: false }).eq('id', id);
  if (error) return { error: error.message };
  return listo();
}

export async function descartarSugerencia(clave) {
  const { supabase } = await exigirMiembro();
  const { data } = await supabase.from('config').select('valor').eq('clave', 'sugerencias_descartadas').maybeSingle();
  const lista = Array.isArray(data?.valor) ? data.valor : [];
  await supabase.from('config').upsert({ clave: 'sugerencias_descartadas', valor: [...new Set([...lista, clave])] });
  return listo();
}

// ---------------- Cuotas ----------------
export async function agregarCuota(fd) {
  const { supabase } = await exigirMiembro();
  const monto = Math.abs(numero(fd.get('monto_cuota')));
  const cantidad = parseInt(fd.get('cantidad'), 10);
  const restantes = parseInt(fd.get('restantes'), 10) || cantidad;
  if (!fd.get('descripcion') || !monto || !cantidad) return { error: 'Completá todos los campos' };
  // Calcula el mes de la primera cuota a partir de cuántas faltan (incluye el próximo resumen)
  const h = hoyAR();
  const pagadas = Math.max(0, cantidad - restantes);
  const t = h.y * 12 + (h.m - 1) + 1 - pagadas; // la próxima cuota cae el mes que viene
  const y = Math.floor(t / 12), m = (t % 12) + 1;
  const { error } = await supabase.from('cuotas').insert({
    descripcion: String(fd.get('descripcion')).trim(),
    monto_cuota: monto,
    cantidad,
    primer_mes: `${periodo(y, m)}-01`,
  });
  if (error) return { error: error.message };
  return listo();
}

export async function borrarCuota(id) {
  const { supabase } = await exigirMiembro();
  const { error } = await supabase.from('cuotas').delete().eq('id', id);
  if (error) return { error: error.message };
  return listo();
}

// ---------------- Metas ----------------
export async function guardarMeta(fd) {
  const { supabase } = await exigirMiembro();
  const objetivo = Math.abs(numero(fd.get('objetivo')));
  if (!fd.get('nombre') || !objetivo) return { error: 'Completá nombre y objetivo' };
  const { error } = await supabase.from('metas').insert({
    nombre: String(fd.get('nombre')).trim(),
    objetivo,
    aporte_mensual: Math.abs(numero(fd.get('aporte_mensual'))) || 0,
    color: fd.get('color') || '#0F766E',
    es_emergencia: fd.get('es_emergencia') === 'on',
  });
  if (error) return { error: error.message };
  return listo();
}

export async function aportarMeta(fd) {
  const { supabase, miembro } = await exigirMiembro();
  const monto = numero(fd.get('monto'));
  if (!monto) return { error: 'Monto inválido' };
  const { error } = await supabase.from('metas_aportes').insert({
    meta_id: fd.get('meta_id'),
    monto, // negativo = retiro
    cargado_por: miembro.email,
  });
  if (error) return { error: error.message };
  return listo();
}

export async function borrarMeta(id) {
  const { supabase } = await exigirMiembro();
  const { error } = await supabase.from('metas').delete().eq('id', id);
  if (error) return { error: error.message };
  return listo();
}

// ---------------- Presupuesto ----------------
export async function guardarPresupuesto(fd) {
  const { supabase } = await exigirMiembro();
  const monto = Math.abs(numero(fd.get('presupuesto')));
  if (!monto) return { error: 'Monto inválido' };
  const { error } = await supabase.from('config').upsert({ clave: 'presupuesto_mensual', valor: monto });
  if (error) return { error: error.message };
  return listo();
}

// ---------------- Sesión ----------------
export async function salir() {
  const { supabase } = await miembroActual();
  await supabase.auth.signOut();
  redirect('/login');
}
