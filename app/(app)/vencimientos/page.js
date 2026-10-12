import { miembroActual } from '@/lib/supabase/server';
import { cargarBase, estadoFijos, cuotasProximas, sugerenciasFijos } from '@/lib/datos';
import { sumarMeses, periodo } from '@/lib/format';
import VencimientosCliente from '@/components/VencimientosCliente';

export default async function Vencimientos() {
  const { supabase } = await miembroActual();
  const base = await cargarBase(supabase);
  const { h, fijos, pagos, cuotas } = base;

  const desde = sumarMeses(h.y, h.m, -3);
  const [{ data: movs }, { data: desc }] = await Promise.all([
    supabase.from('movimientos').select('descripcion, monto, fecha, categoria')
      .gte('fecha', `${periodo(desde.y, desde.m)}-01`).neq('origen', 'manual'),
    supabase.from('config').select('valor').eq('clave', 'sugerencias_descartadas').maybeSingle(),
  ]);

  const estado = estadoFijos(fijos, pagos, h);
  const sugerencias = sugerenciasFijos(movs || [], fijos, Array.isArray(desc?.valor) ? desc.valor : []);
  const { meses, activas } = cuotasProximas(cuotas, h, 4);

  return (
    <VencimientosCliente
      fijos={estado}
      sugerencia={sugerencias[0] || null}
      cuotasMeses={meses}
      cuotas={activas}
      mesTitulo={`${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][h.m - 1]} ${h.y}`}
    />
  );
}
