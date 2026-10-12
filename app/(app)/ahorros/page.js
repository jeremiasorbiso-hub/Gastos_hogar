import { miembroActual } from '@/lib/supabase/server';
import { cargarBase, saldos, gastoDelMes } from '@/lib/datos';
import { sumarMeses, periodo, MESES, MESES_CORTOS } from '@/lib/format';
import AhorrosCliente from '@/components/AhorrosCliente';

export default async function Ahorros() {
  const { supabase } = await miembroActual();
  const { h, cuentas, fijos } = await cargarBase(supabase);
  const desde = sumarMeses(h.y, h.m, -5);

  const [{ data: metas }, { data: aportes }, { data: movs }] = await Promise.all([
    supabase.from('metas').select('*').order('created_at'),
    supabase.from('metas_aportes').select('meta_id, monto, fecha'),
    supabase.from('movimientos').select('monto, categoria, fecha').gte('fecha', `${periodo(desde.y, desde.m)}-01`),
  ]);

  const porMeta = {};
  for (const a of aportes || []) porMeta[a.meta_id] = (porMeta[a.meta_id] || 0) + Number(a.monto);
  const listaMetas = (metas || []).map((m) => ({
    ...m,
    objetivo: Number(m.objetivo),
    aporte_mensual: Number(m.aporte_mensual),
    tiene: porMeta[m.id] || 0,
  }));

  // Ahorro de cada mes = ingresos − gastos
  const historial = [];
  for (let i = 0; i < 6; i++) {
    const { y, m } = sumarMeses(desde.y, desde.m, i);
    const per = periodo(y, m);
    const delMes = (movs || []).filter((x) => x.fecha.startsWith(per));
    const { gastos, ingresos } = gastoDelMes(delMes);
    historial.push({ mes: MESES_CORTOS[m - 1], neto: ingresos - gastos, actual: i === 5 });
  }

  const fijosMes = fijos.reduce((a, f) => a + Number(f.monto), 0);
  const emergencia = listaMetas.filter((m) => m.es_emergencia).reduce((a, m) => a + m.tiene, 0);

  return (
    <AhorrosCliente
      mesTitulo={`${MESES[h.m - 1]} ${h.y}`}
      metas={listaMetas}
      totalAhorrado={listaMetas.reduce((a, m) => a + m.tiene, 0)}
      usd={saldos(cuentas).usd}
      esteMes={historial[5].neto}
      historial={historial}
      cobertura={fijosMes ? emergencia / fijosMes : null}
      hayEmergencia={listaMetas.some((m) => m.es_emergencia)}
    />
  );
}
