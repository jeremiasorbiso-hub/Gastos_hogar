import Link from 'next/link';
import { miembroActual } from '@/lib/supabase/server';
import { cargarBase, saldos, estadoFijos, gastoDelMes, mapaMiembros } from '@/lib/datos';
import { MESES, MESES_CORTOS, diasDelMes, etiquetaDia } from '@/lib/format';
import { Monto, BotonOjo } from '@/components/Privacidad';
import { Sincronizacion, Cuentas, EditarPresupuesto } from '@/components/InicioCliente';
import FilaMovimiento from '@/components/FilaMovimiento';
import { Mas } from '@/components/Iconos';

export default async function Inicio() {
  const { supabase } = await miembroActual();
  const base = await cargarBase(supabase);
  const { h, per, cuentas, miembros, fijos, pagos, presupuesto } = base;

  const [{ data: movsMes }, { data: ultimos }] = await Promise.all([
    supabase.from('movimientos').select('monto, categoria').gte('fecha', `${per}-01`),
    supabase.from('movimientos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(5),
  ]);

  const quien = mapaMiembros(miembros);
  const { ars, usd } = saldos(cuentas);
  const estado = estadoFijos(fijos, pagos, h);
  const pendientes = estado.filter((f) => !f.pagado).sort((a, b) => a.faltan - b.faltan);
  const porPagar = pendientes.reduce((a, f) => a + f.monto, 0);
  const disponible = ars - porPagar;

  const { gastos } = gastoDelMes(movsMes || []);
  const dias = diasDelMes(h.y, h.m);
  const pctGasto = presupuesto ? Math.round((gastos / presupuesto) * 100) : 0;
  const pctRitmo = Math.round((h.d / dias) * 100);
  const porDia = gastos / h.d;
  const diaFin = porDia > 0 ? Math.ceil(presupuesto / porDia) : null;
  const vaPasado = presupuesto && pctGasto > pctRitmo + 5;

  const cuentasApi = cuentas.filter((c) => c.fuente === 'api');

  return (
    <>
      <header className="encabezado">
        <div>
          <p className="sub">{MESES[h.m - 1]} {h.y}</p>
          <h1 className="titulo">Nuestra plata</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BotonOjo />
          <div className="avatares">
            {miembros.map((m) => (
              <span key={m.email} className="avatar" style={{ background: m.color }} title={m.nombre}>{m.inicial}</span>
            ))}
          </div>
        </div>
      </header>

      <Sincronizacion cuentasApi={cuentasApi} />

      <section className="tarjeta-oscura">
        <span className="etq">Disponible real</span>
        <span className="grande"><Monto n={disponible} /></span>
        <div className="pie">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="etq">Saldo en cuentas</span>
            <span className="val"><Monto n={ars} /></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="etq">Falta pagar este mes</span>
            <span className="val naranja">− <Monto n={porPagar} /></span>
          </div>
        </div>
        {usd > 0 && <span className="etq">Además tienen <Monto n={usd} moneda="USD" /></span>}
      </section>

      <section className="tarjeta">
        <div className="cab-tarjeta">
          <h2>Gasto del mes</h2>
          <EditarPresupuesto actual={presupuesto} />
        </div>
        {presupuesto ? (
          <>
            <span className="mini"><Monto n={gastos} /> de <Monto n={presupuesto} /></span>
            <div className="barra" role="img" aria-label={`${pctGasto}% del presupuesto usado, día ${h.d} de ${dias}`}>
              <div className={`relleno ${vaPasado ? 'alerta' : ''}`} style={{ width: `${Math.min(100, pctGasto)}%` }} />
              <div className="marca" style={{ left: `${pctRitmo}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="mini">
              <span>{pctGasto}% usado</span>
              <span>| día {h.d} de {dias} ({pctRitmo}%)</span>
            </div>
            {pctGasto >= 100 ? (
              <p className="aviso">Ya se pasaron del presupuesto del mes.</p>
            ) : vaPasado && diaFin && diaFin <= dias ? (
              <p className="aviso">Van por encima del ritmo del mes. A este paso, el presupuesto se termina el {diaFin}.</p>
            ) : (
              <p className="aviso ok">Van bien: a este ritmo llegan a fin de mes dentro del presupuesto.</p>
            )}
          </>
        ) : (
          <p className="mini">Gastaron <Monto n={gastos} /> este mes. Definan un presupuesto para ver si van bien.</p>
        )}
      </section>

      <section className="tarjeta">
        <div className="cab-tarjeta">
          <h2>Próximos vencimientos</h2>
          <Link href="/vencimientos">Ver todos</Link>
        </div>
        {pendientes.length === 0 ? (
          <p className="vacio">{fijos.length ? 'Todo pagado este mes.' : 'Todavía no cargaron gastos fijos.'}</p>
        ) : pendientes.slice(0, 3).map((f) => (
          <div key={f.id} className="fila">
            <div className="fecha-caja"><b>{f.dia}</b><span>{MESES_CORTOS[h.m - 1]}</span></div>
            <div className="medio">
              <span className="nombre">{f.nombre}</span>
              <span className="mini" style={f.faltan <= 2 ? { color: 'var(--alerta)' } : undefined}>
                {f.faltan < 0 ? `Venció hace ${-f.faltan} días` : f.faltan === 0 ? 'Vence hoy' : `en ${f.faltan} días`}
              </span>
            </div>
            <span className="monto"><Monto n={f.monto} /></span>
          </div>
        ))}
      </section>

      <section className="tarjeta">
        <div className="cab-tarjeta">
          <h2>Últimos movimientos</h2>
          <Link href="/movimientos">Ver todos</Link>
        </div>
        {(ultimos || []).length === 0 ? (
          <p className="vacio">Sin movimientos todavía.</p>
        ) : ultimos.map((m) => (
          <FilaMovimiento key={m.id} m={m} quien={quien[m.cargado_por?.toLowerCase()]} extra={etiquetaDia(m.fecha)} />
        ))}
      </section>

      <section className="tarjeta">
        <div className="cab-tarjeta"><h2>Cuentas</h2></div>
        <Cuentas cuentas={cuentas} />
      </section>

      <Link href="/movimientos?nuevo=1" className="fab" aria-label="Agregar movimiento"><Mas /></Link>
    </>
  );
}
