import { supabaseAdmin } from '@/lib/supabase/server';
import { leerBanco } from './banco';
import { leerMercadoPago } from './mercadopago';
import { hoyAR, periodo } from '@/lib/format';

// Busca la categoría según las reglas aprendidas
export function categorizar(descripcion, monto, reglas) {
  const d = ` ${descripcion.toLowerCase()} `;
  // Las reglas más largas (más específicas) primero
  const orden = [...reglas].sort((a, b) => b.patron.length - a.patron.length);
  const r = orden.find((x) => d.includes(x.patron.toLowerCase()));
  if (r) return r.categoria;
  return monto > 0 ? 'Ingreso' : 'Otros';
}

async function importar(db, { tipo, origen, leer }) {
  const { data: cuenta } = await db.from('cuentas').select('*').eq('tipo', tipo).eq('fuente', 'api').limit(1).maybeSingle();
  if (!cuenta) return { origen, omitido: 'no hay cuenta automática de este tipo' };

  let datos;
  try {
    datos = await leer();
  } catch (e) {
    await db.from('cuentas').update({ sync_error: String(e.message || e) }).eq('id', cuenta.id);
    return { origen, error: String(e.message || e) };
  }
  if (!datos) return { origen, omitido: 'sin credenciales configuradas' };

  const { data: reglas } = await db.from('reglas').select('*');
  const filas = datos.movimientos.map((m) => ({
    cuenta_id: cuenta.id,
    fecha: m.fecha,
    descripcion: m.descripcion,
    monto: m.monto,
    categoria: categorizar(m.descripcion, m.monto, reglas || []),
    origen,
    external_id: m.id,
  }));

  let nuevos = 0;
  if (filas.length) {
    // ignoreDuplicates: no pisa categorías que ustedes ya corrigieron
    const { data, error } = await db.from('movimientos')
      .upsert(filas, { onConflict: 'external_id', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    nuevos = data?.length || 0;
  }

  const cambios = { actualizado_at: new Date().toISOString(), sync_error: null };
  if (datos.saldo != null) cambios.saldo = datos.saldo;
  await db.from('cuentas').update(cambios).eq('id', cuenta.id);

  return { origen, nuevos, saldo: datos.saldo };
}

// Marca como pagados los gastos fijos que aparecen en los movimientos del mes
async function detectarFijosPagados(db) {
  const h = hoyAR();
  const per = periodo(h.y, h.m);
  const desde = `${per}-01`;

  const [{ data: fijos }, { data: pagos }, { data: movs }] = await Promise.all([
    db.from('fijos').select('*').eq('activo', true).not('patron', 'is', null),
    db.from('fijos_pagos').select('fijo_id').eq('periodo', per),
    db.from('movimientos').select('id, descripcion, monto').gte('fecha', desde).lt('monto', 0),
  ]);
  const yaPagados = new Set((pagos || []).map((p) => p.fijo_id));

  const nuevos = [];
  for (const f of fijos || []) {
    if (yaPagados.has(f.id) || !f.patron?.trim()) continue;
    const mov = (movs || []).find((m) => m.descripcion.toLowerCase().includes(f.patron.toLowerCase()));
    if (mov) nuevos.push({ fijo_id: f.id, periodo: per, auto: true, movimiento_id: mov.id });
  }
  if (nuevos.length) await db.from('fijos_pagos').upsert(nuevos, { onConflict: 'fijo_id,periodo', ignoreDuplicates: true });
  return nuevos.length;
}

export async function sincronizarTodo() {
  const db = supabaseAdmin();
  const resultados = [];
  resultados.push(await importar(db, { tipo: 'banco', origen: 'banco', leer: leerBanco }));
  resultados.push(await importar(db, { tipo: 'mercadopago', origen: 'mercadopago', leer: leerMercadoPago }));
  const fijosDetectados = await detectarFijosPagados(db);
  return { resultados, fijosDetectados, at: new Date().toISOString() };
}
