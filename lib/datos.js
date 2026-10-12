import { hoyAR, periodo, sumarMeses, patronDe, NO_ES_GASTO, MESES_CORTOS } from '@/lib/format';

// Datos que usan varias pantallas
export async function cargarBase(supabase) {
  const h = hoyAR();
  const per = periodo(h.y, h.m);
  const [cuentas, miembros, fijos, pagos, presupuesto, cuotas] = await Promise.all([
    supabase.from('cuentas').select('*').order('orden'),
    supabase.from('miembros').select('*'),
    supabase.from('fijos').select('*').eq('activo', true).order('dia'),
    supabase.from('fijos_pagos').select('*').eq('periodo', per),
    supabase.from('config').select('valor').eq('clave', 'presupuesto_mensual').maybeSingle(),
    supabase.from('cuotas').select('*'),
  ]);
  return {
    h,
    per,
    cuentas: cuentas.data || [],
    miembros: miembros.data || [],
    fijos: fijos.data || [],
    pagos: pagos.data || [],
    presupuesto: Number(presupuesto.data?.valor) || 0,
    cuotas: cuotas.data || [],
  };
}

export function mapaMiembros(miembros) {
  const m = {};
  for (const x of miembros) m[x.email.toLowerCase()] = x;
  return m;
}

export function saldos(cuentas) {
  const ars = cuentas.filter((c) => c.moneda === 'ARS').reduce((a, c) => a + Number(c.saldo), 0);
  const usd = cuentas.filter((c) => c.moneda === 'USD').reduce((a, c) => a + Number(c.saldo), 0);
  return { ars, usd };
}

export function estadoFijos(fijos, pagos, h) {
  const porId = new Map(pagos.map((p) => [p.fijo_id, p]));
  return fijos.map((f) => {
    const p = porId.get(f.id);
    return {
      ...f,
      monto: Number(f.monto),
      pagado: !!p,
      auto: !!p?.auto,
      faltan: f.dia - h.d,
    };
  });
}

export function gastoDelMes(movs) {
  let gastos = 0, ingresos = 0;
  for (const m of movs) {
    const n = Number(m.monto);
    if (n < 0 && !NO_ES_GASTO.includes(m.categoria)) gastos += -n;
    if (n > 0 && m.categoria === 'Ingreso') ingresos += n;
  }
  return { gastos, ingresos };
}

// Cuánto hay comprometido en cuotas para los próximos `n` meses
export function cuotasProximas(cuotas, h, n = 4) {
  const meses = [];
  for (let i = 1; i <= n; i++) {
    const { y, m } = sumarMeses(h.y, h.m, i);
    const idx = y * 12 + m;
    let total = 0;
    for (const c of cuotas) {
      const [cy, cm] = c.primer_mes.split('-').map(Number);
      const ini = cy * 12 + cm;
      const fin = ini + c.cantidad - 1;
      if (idx >= ini && idx <= fin) total += Number(c.monto_cuota);
    }
    meses.push({ mes: MESES_CORTOS[m - 1], total });
  }
  // Cuotas que terminan pronto (para avisar cuánto se libera)
  const terminan = cuotas
    .map((c) => {
      const [cy, cm] = c.primer_mes.split('-').map(Number);
      const finIdx = cy * 12 + cm + c.cantidad - 1;
      const hoyIdx = h.y * 12 + h.m;
      return { ...c, mesesRestantes: finIdx - hoyIdx, ultimoMes: MESES_CORTOS[((finIdx - 1) % 12)] };
    })
    .filter((c) => c.mesesRestantes >= 0)
    .sort((a, b) => a.mesesRestantes - b.mesesRestantes);
  return { meses, activas: terminan };
}

// Detecta comercios que cobran todos los meses y todavía no son gastos fijos
export function sugerenciasFijos(movs, fijos, descartadas = []) {
  const grupos = new Map();
  for (const m of movs) {
    if (Number(m.monto) >= 0 || NO_ES_GASTO.includes(m.categoria)) continue;
    const clave = patronDe(m.descripcion);
    if (clave.length < 3) continue;
    const g = grupos.get(clave) || { clave, ejemplo: m.descripcion, meses: new Set(), montos: [], dias: [] };
    g.meses.add(m.fecha.slice(0, 7));
    g.montos.push(-Number(m.monto));
    g.dias.push(Number(m.fecha.slice(8, 10)));
    grupos.set(clave, g);
  }
  const cubiertos = fijos.map((f) => (f.patron || f.nombre).toLowerCase());
  return [...grupos.values()]
    .filter((g) => g.meses.size >= 2 && g.montos.length <= g.meses.size + 1) // ~1 cobro por mes
    .filter((g) => !descartadas.includes(g.clave))
    .filter((g) => !cubiertos.some((c) => c.includes(g.clave) || g.clave.includes(c)))
    .map((g) => ({
      clave: g.clave,
      nombre: g.ejemplo,
      monto: Math.round(g.montos.reduce((a, b) => a + b, 0) / g.montos.length),
      dia: Math.round(g.dias.reduce((a, b) => a + b, 0) / g.dias.length),
      meses: g.meses.size,
    }))
    .sort((a, b) => b.meses - a.meses || b.monto - a.monto);
}
