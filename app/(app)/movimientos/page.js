import { miembroActual } from '@/lib/supabase/server';
import { hoyAR, periodo, sumarMeses, MESES, CATEGORIAS_GASTO, CATEGORIAS_ESPECIALES } from '@/lib/format';
import MovimientosCliente from '@/components/MovimientosCliente';

export default async function Movimientos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, miembro } = await miembroActual();
  const h = hoyAR();

  const [y, m] = /^\d{4}-\d{2}$/.test(sp?.mes || '') ? sp.mes.split('-').map(Number) : [h.y, h.m];
  const sig = sumarMeses(y, m, 1);
  const ant = sumarMeses(y, m, -1);

  const [{ data: movs }, { data: cuentas }, { data: miembros }] = await Promise.all([
    supabase.from('movimientos').select('*')
      .gte('fecha', `${periodo(y, m)}-01`).lt('fecha', `${periodo(sig.y, sig.m)}-01`)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('cuentas').select('id, nombre, moneda').order('orden'),
    supabase.from('miembros').select('*'),
  ]);

  const esActual = y === h.y && m === h.m;
  return (
    <MovimientosCliente
      movs={movs || []}
      cuentas={cuentas || []}
      miembros={miembros || []}
      yo={miembro.email}
      categorias={[...CATEGORIAS_GASTO, ...CATEGORIAS_ESPECIALES]}
      filtro={sp?.cat || 'Todos'}
      abrirNuevo={sp?.nuevo === '1'}
      mes={{
        titulo: `${MESES[m - 1]} ${y}`,
        actual: periodo(y, m),
        anterior: periodo(ant.y, ant.m),
        siguiente: esActual ? null : periodo(sig.y, sig.m),
      }}
    />
  );
}
