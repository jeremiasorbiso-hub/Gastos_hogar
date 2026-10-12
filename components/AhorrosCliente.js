'use client';

import { useState } from 'react';
import { Hoja, useAccion } from './Hoja';
import { Monto } from './Privacidad';
import { Mas, Escudo } from './Iconos';
import { guardarMeta, aportarMeta, borrarMeta } from '@/app/actions';
import { pesos } from '@/lib/format';

const COLORES = [
  { color: '#0F766E', tinte: '#E3EDE8' },
  { color: '#C2410C', tinte: '#FFF1E7' },
  { color: '#3F4FA0', tinte: '#E8EAF6' },
  { color: '#8A5A00', tinte: '#FBF0D9' },
];
const tinteDe = (c) => COLORES.find((x) => x.color === c)?.tinte || '#EEF1EE';

export default function AhorrosCliente({ mesTitulo, metas, totalAhorrado, usd, esteMes, historial, cobertura, hayEmergencia }) {
  const [nueva, setNueva] = useState(false);
  const [aportando, setAportando] = useState(null);
  const max = Math.max(1, ...historial.map((x) => Math.abs(x.neto)));

  return (
    <>
      <header className="encabezado">
        <div>
          <p className="sub">{mesTitulo}</p>
          <h1 className="titulo">Ahorros</h1>
        </div>
      </header>

      <section className="tarjeta-oscura">
        <span className="etq">Total ahorrado en metas</span>
        <span className="grande" style={{ fontSize: 38 }}><Monto n={totalAhorrado} /></span>
        <div className="pie">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="etq">En dólares</span>
            <span className="val"><Monto n={usd} moneda="USD" /></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="etq">Ahorrado este mes</span>
            <span className={`val ${esteMes >= 0 ? 'verde-claro' : 'naranja'}`}><Monto n={esteMes} signo /></span>
          </div>
        </div>
      </section>

      {hayEmergencia && cobertura != null && (
        <section className="tarjeta" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 16, background: 'var(--acento-claro)', color: 'var(--acento)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Escudo />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{cobertura.toFixed(1).replace('.', ',')} meses cubiertos</span>
            <span className="mini" style={{ fontSize: 13 }}>Con el fondo de emergencia cubren sus gastos fijos ese tiempo. Lo recomendable son 3 a 6 meses.</span>
          </div>
        </section>
      )}

      <div className="seccion-titulo">
        <h2>Metas</h2>
        <button className="link-btn" onClick={() => setNueva(true)}><Mas t={16} /> Nueva meta</button>
      </div>

      <div className="metas">
        {metas.length === 0 && (
          <div className="meta"><p className="vacio">Creen su primera meta: vacaciones, fondo de emergencia, algo para la casa…</p></div>
        )}
        {metas.map((m) => {
          const pct = Math.min(100, Math.round((m.tiene / m.objetivo) * 100));
          const falta = m.objetivo - m.tiene;
          const meses = falta > 0 && m.aporte_mensual > 0 ? Math.ceil(falta / m.aporte_mensual) : null;
          return (
            <article key={m.id} className="meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="icono" style={{ background: tinteDe(m.color), color: m.color }}>{pct}%</div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{m.nombre}</span>
                  <span className="mini" style={{ fontSize: 13 }}><Monto n={m.tiene} /> de <Monto n={m.objetivo} /></span>
                </div>
              </div>
              <div className="barra" style={{ height: 10 }}>
                <div className="relleno" style={{ width: `${pct}%`, background: m.color }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span className="mini" style={{ fontSize: 13 }}>
                  {falta <= 0 ? '¡Meta cumplida!' : meses ? `Con ${pesos(m.aporte_mensual)}/mes llegan en ${meses} ${meses === 1 ? 'mes' : 'meses'}` : 'Definan un aporte mensual para ver cuándo llegan'}
                </span>
                <button className="btn chico borde" style={{ whiteSpace: 'nowrap' }} onClick={() => setAportando(m)}>+ Aportar</button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="tarjeta">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Cuánto ahorraron por mes</h2>
          <span className="mini">Lo que entró menos lo que se gastó</span>
        </div>
        <div className="columnas" role="img" aria-label={historial.map((x) => `${x.mes}: ${pesos(x.neto)}`).join(', ')}>
          {historial.map((x) => (
            <div key={x.mes}>
              <div className={`col ${x.neto < 0 ? 'neg' : x.actual ? 'actual' : ''}`} style={{ height: `${Math.max(6, Math.round((Math.abs(x.neto) / max) * 96))}px` }} />
              <span className="mini" style={{ fontSize: 11 }}>{x.mes}</span>
            </div>
          ))}
        </div>
      </section>

      <FormMeta abierta={nueva} onCerrar={() => setNueva(false)} />
      <FormAporte meta={aportando} onCerrar={() => setAportando(null)} />
    </>
  );
}

function FormMeta({ abierta, onCerrar }) {
  const [color, setColor] = useState(COLORES[0].color);
  const { pendiente, error, enviar } = useAccion(guardarMeta, { alTerminar: onCerrar });
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Nueva meta">
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input type="hidden" name="color" value={color} />
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" placeholder="Ej: Vacaciones de verano" required />
        </div>
        <div className="dos">
          <div className="campo">
            <label htmlFor="objetivo">Objetivo ($)</label>
            <input id="objetivo" name="objetivo" inputMode="decimal" required />
          </div>
          <div className="campo">
            <label htmlFor="aporte_mensual">Aporte por mes ($)</label>
            <input id="aporte_mensual" name="aporte_mensual" inputMode="decimal" />
          </div>
        </div>
        <div className="campo">
          <span className="etq">Color</span>
          <div className="chips">
            {COLORES.map((c) => (
              <button key={c.color} type="button" aria-label={`Color ${c.color}`} aria-pressed={color === c.color} onClick={() => setColor(c.color)}
                style={{ width: 44, height: 44, borderRadius: 22, background: c.color, border: color === c.color ? '3px solid var(--tinta)' : '3px solid transparent' }} />
            ))}
          </div>
        </div>
        <label className="check-campo">
          <input type="checkbox" name="es_emergencia" /> Es el fondo de emergencia
        </label>
        {error && <p className="error-form">{error}</p>}
        <button className="btn" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Crear meta'}</button>
      </form>
    </Hoja>
  );
}

function FormAporte({ meta, onCerrar }) {
  const [retiro, setRetiro] = useState(false);
  const aportar = useAccion(aportarMeta, { alTerminar: cerrar });
  const borrar = useAccion(borrarMeta, { alTerminar: cerrar });
  function cerrar() { setRetiro(false); onCerrar(); }

  const enviar = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const n = String(fd.get('monto') || '').trim();
    fd.set('monto', retiro ? `-${n}` : n);
    aportar.correr(fd);
  };

  return (
    <Hoja abierta={!!meta} onCerrar={cerrar} titulo={meta?.nombre || ''}>
      {meta && (
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="meta_id" value={meta.id} />
          <div className="segmento">
            <button type="button" className={!retiro ? 'on' : ''} onClick={() => setRetiro(false)}>Aportar</button>
            <button type="button" className={retiro ? 'on' : ''} onClick={() => setRetiro(true)}>Retirar</button>
          </div>
          <div className="campo">
            <label htmlFor="monto-meta">Monto</label>
            <input id="monto-meta" name="monto" className="monto-grande" inputMode="decimal" defaultValue={meta.aporte_mensual || ''} autoFocus required />
          </div>
          {(aportar.error || borrar.error) && <p className="error-form">{aportar.error || borrar.error}</p>}
          <button className="btn" disabled={aportar.pendiente}>{aportar.pendiente ? 'Guardando…' : retiro ? 'Registrar retiro' : 'Registrar aporte'}</button>
          <button type="button" className="btn peligro" disabled={borrar.pendiente}
            onClick={() => confirm(`¿Borrar la meta "${meta.nombre}" y todos sus aportes?`) && borrar.correr(meta.id)}>
            Borrar meta
          </button>
        </form>
      )}
    </Hoja>
  );
}
