'use client';

import { useState } from 'react';
import { Hoja, useAccion } from './Hoja';
import { Monto } from './Privacidad';
import { Mas, Tilde } from './Iconos';
import { marcarFijo, guardarFijo, borrarFijo, descartarSugerencia, agregarCuota, borrarCuota } from '@/app/actions';

export default function VencimientosCliente({ fijos, sugerencia, cuotasMeses, cuotas, mesTitulo }) {
  const [editFijo, setEditFijo] = useState(null); // {} = nuevo
  const [nuevaCuota, setNuevaCuota] = useState(false);
  const marcar = useAccion(marcarFijo);
  const descartar = useAccion(descartarSugerencia);
  const aceptar = useAccion(guardarFijo);
  const quitarCuota = useAccion(borrarCuota);

  const pend = fijos.filter((f) => !f.pagado).reduce((a, f) => a + f.monto, 0);
  const pag = fijos.filter((f) => f.pagado).reduce((a, f) => a + f.monto, 0);
  const nPag = fijos.filter((f) => f.pagado).length;
  const pct = pend + pag ? Math.round((pag / (pend + pag)) * 100) : 0;
  const maxCuota = Math.max(1, ...cuotasMeses.map((m) => m.total));
  const proxima = cuotas.find((c) => c.mesesRestantes <= 3);

  const aceptarSugerencia = () => {
    const fd = new FormData();
    fd.set('nombre', sugerencia.nombre);
    fd.set('dia', String(sugerencia.dia));
    fd.set('monto', String(sugerencia.monto));
    fd.set('patron', sugerencia.clave);
    aceptar.correr(fd);
  };

  return (
    <>
      <header className="encabezado">
        <div>
          <p className="sub">{mesTitulo}</p>
          <h1 className="titulo">Fijos y vencimientos</h1>
        </div>
      </header>

      <section className="tarjeta">
        <div className="dos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="mini">Falta pagar</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: 'var(--alerta)' }}><Monto n={pend} /></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="mini">Ya pagado</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700 }}><Monto n={pag} /></span>
          </div>
        </div>
        <div className="barra" style={{ height: 10, background: 'var(--alerta-claro)' }} role="img" aria-label={`${pct}% pagado`}>
          <div className="relleno" style={{ width: `${pct}%` }} />
        </div>
        <span className="mini">{nPag} de {fijos.length} pagados este mes</span>
      </section>

      <section className="tarjeta lista">
        {fijos.length === 0 && <p className="vacio">Agreguen alquiler, expensas, servicios, prepaga…</p>}
        {fijos.map((f) => (
          <div key={f.id} className={`fila ${f.pagado ? 'apagada' : ''}`}>
            <button
              className={`check ${f.pagado ? 'on' : ''}`}
              aria-label={f.pagado ? `Marcar ${f.nombre} como pendiente` : `Marcar ${f.nombre} como pagado`}
              aria-pressed={f.pagado}
              disabled={marcar.pendiente}
              onClick={() => marcar.correr({ fijo_id: f.id, pagado: !f.pagado })}
            >
              {f.pagado && <Tilde />}
            </button>
            <button type="button" className="medio" onClick={() => setEditFijo(f)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', minHeight: 44, justifyContent: 'center' }}>
              <span className="nombre">{f.nombre}</span>
              <span className="mini" style={!f.pagado && f.faltan <= 2 ? { color: 'var(--alerta)' } : undefined}>
                {f.pagado
                  ? (f.auto ? 'Pagado · detectado en el banco' : 'Pagado · marcado a mano')
                  : f.faltan < 0 ? `Venció el ${f.dia} · hace ${-f.faltan} días`
                  : f.faltan === 0 ? 'Vence hoy'
                  : `Vence el ${f.dia} · en ${f.faltan} días`}
              </span>
            </button>
            <span className="monto"><Monto n={f.monto} /></span>
          </div>
        ))}
        <button className="link-btn" style={{ minHeight: 48 }} onClick={() => setEditFijo({})}><Mas t={18} /> Agregar gasto fijo</button>
      </section>

      {sugerencia && (
        <section className="tarjeta" style={{ background: 'var(--acento-claro)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--acento-osc)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Detectado en el banco</span>
          <p>
            &ldquo;{sugerencia.nombre}&rdquo; les cobró en {sugerencia.meses} meses distintos, alrededor de <Monto n={sugerencia.monto} />. ¿Lo agregamos como gasto fijo?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn chico" disabled={aceptar.pendiente} onClick={aceptarSugerencia}>Agregar</button>
            <button className="btn chico borde" disabled={descartar.pendiente} onClick={() => descartar.correr(sugerencia.clave)}>Ahora no</button>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <div className="cab-tarjeta">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Cuotas de tarjeta comprometidas</h2>
            <span className="mini">Lo que ya está gastado en cuotas para los próximos resúmenes</span>
          </div>
        </div>
        {cuotasMeses.map((m) => (
          <div key={m.mes} className="cuota-fila">
            <span className="mini" style={{ fontSize: 13 }}>{m.mes}</span>
            <div className="barra"><div className="relleno" style={{ width: `${Math.round((m.total / maxCuota) * 100)}%` }} /></div>
            <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' }}><Monto n={m.total} /></span>
          </div>
        ))}
        {proxima && (
          <p className="aviso ok">
            En {proxima.ultimoMes} termina &ldquo;{proxima.descripcion}&rdquo;: se liberan <Monto n={proxima.monto_cuota} /> por mes.
          </p>
        )}
        {cuotas.map((c) => (
          <div key={c.id} className="fila">
            <div className="medio">
              <span className="nombre">{c.descripcion}</span>
              <span className="mini">Quedan {c.mesesRestantes} de {c.cantidad} cuotas · termina en {c.ultimoMes}</span>
            </div>
            <span className="monto"><Monto n={c.monto_cuota} /></span>
            <button className="btn-icono sin-borde" aria-label={`Borrar ${c.descripcion}`} disabled={quitarCuota.pendiente}
              onClick={() => confirm(`¿Borrar "${c.descripcion}"?`) && quitarCuota.correr(c.id)}>×</button>
          </div>
        ))}
        <button className="link-btn" onClick={() => setNuevaCuota(true)}><Mas t={18} /> Agregar compra en cuotas</button>
      </section>

      <FormFijo fijo={editFijo} onCerrar={() => setEditFijo(null)} />
      <FormCuota abierta={nuevaCuota} onCerrar={() => setNuevaCuota(false)} />
    </>
  );
}

function FormFijo({ fijo, onCerrar }) {
  const guardar = useAccion(guardarFijo, { alTerminar: onCerrar });
  const borrar = useAccion(borrarFijo, { alTerminar: onCerrar });
  const esNuevo = fijo && !fijo.id;
  return (
    <Hoja abierta={!!fijo} onCerrar={onCerrar} titulo={esNuevo ? 'Nuevo gasto fijo' : 'Editar gasto fijo'}>
      {fijo && (
        <form onSubmit={guardar.enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!esNuevo && <input type="hidden" name="id" value={fijo.id} />}
          <div className="campo">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" name="nombre" defaultValue={fijo.nombre || ''} placeholder="Ej: Expensas" required />
          </div>
          <div className="dos">
            <div className="campo">
              <label htmlFor="monto">Monto aproximado</label>
              <input id="monto" name="monto" inputMode="decimal" defaultValue={fijo.monto || ''} required />
            </div>
            <div className="campo">
              <label htmlFor="dia">Vence el día</label>
              <input id="dia" name="dia" type="number" min="1" max="31" defaultValue={fijo.dia || 10} required />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="patron">Texto que aparece en el banco (opcional)</label>
            <input id="patron" name="patron" defaultValue={fijo.patron || ''} placeholder="Ej: edenor" />
            <span className="mini">Si un movimiento del banco contiene este texto, se marca pagado solo.</span>
          </div>
          {(guardar.error || borrar.error) && <p className="error-form">{guardar.error || borrar.error}</p>}
          <button className="btn" disabled={guardar.pendiente}>{guardar.pendiente ? 'Guardando…' : 'Guardar'}</button>
          {!esNuevo && (
            <button type="button" className="btn peligro" disabled={borrar.pendiente}
              onClick={() => confirm(`¿Quitar "${fijo.nombre}" de los gastos fijos?`) && borrar.correr(fijo.id)}>
              Quitar gasto fijo
            </button>
          )}
        </form>
      )}
    </Hoja>
  );
}

function FormCuota({ abierta, onCerrar }) {
  const { pendiente, error, enviar } = useAccion(agregarCuota, { alTerminar: onCerrar });
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Compra en cuotas">
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="campo">
          <label htmlFor="descripcion">Qué compraron</label>
          <input id="descripcion" name="descripcion" placeholder="Ej: Heladera" required />
        </div>
        <div className="campo">
          <label htmlFor="monto_cuota">Monto de cada cuota</label>
          <input id="monto_cuota" name="monto_cuota" inputMode="decimal" required />
        </div>
        <div className="dos">
          <div className="campo">
            <label htmlFor="cantidad">Total de cuotas</label>
            <input id="cantidad" name="cantidad" type="number" min="1" max="60" defaultValue="12" required />
          </div>
          <div className="campo">
            <label htmlFor="restantes">Cuántas faltan pagar</label>
            <input id="restantes" name="restantes" type="number" min="1" max="60" defaultValue="12" required />
          </div>
        </div>
        {error && <p className="error-form">{error}</p>}
        <button className="btn" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Hoja>
  );
}
