'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hoja, useAccion } from './Hoja';
import { Monto } from './Privacidad';
import { Refrescar, Lapiz } from './Iconos';
import { sincronizarAhora, saldoManual, guardarPresupuesto } from '@/app/actions';
import { hace } from '@/lib/format';

// Chips de "Banco · actualizado hace X" + sincronización automática al abrir
export function Sincronizacion({ cuentasApi }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const { pendiente, correr } = useAccion(sincronizarAhora, {
    alTerminar: (r) => {
      setMsg(r.ok ? (r.nuevos ? `${r.nuevos} movimientos nuevos` : 'Todo al día') : '');
      router.refresh();
    },
  });
  const yaCorrio = useRef(false);

  // Si la última sincronización tiene más de 3 horas, sincroniza sola al abrir
  useEffect(() => {
    if (yaCorrio.current || !cuentasApi.length) return;
    const viejo = cuentasApi.some((c) => Date.now() - new Date(c.actualizado_at).getTime() > 3 * 3600 * 1000);
    if (viejo) { yaCorrio.current = true; correr(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cuentasApi.length) return null;
  return (
    <div className="sync-fila">
      {cuentasApi.map((c) => (
        <button key={c.id} className={`sync ${c.sync_error ? 'error' : ''}`} onClick={() => correr()} disabled={pendiente}
          title={c.sync_error || ''}>
          <span className="punto" />
          <span>
            {pendiente ? 'Sincronizando…' : c.sync_error ? `${c.nombre} · no se pudo actualizar` : `${c.nombre} · ${hace(c.actualizado_at)}`}
          </span>
          <Refrescar />
        </button>
      ))}
      {msg && !pendiente && <span className="mini" style={{ alignSelf: 'center' }}>{msg}</span>}
    </div>
  );
}

// Lista de cuentas con opción de cargar el saldo a mano
export function Cuentas({ cuentas }) {
  const [editando, setEditando] = useState(null);
  const { pendiente, error, enviar } = useAccion(saldoManual, { alTerminar: () => setEditando(null) });

  return (
    <>
      {cuentas.map((c) => (
        <div key={c.id} className="fila">
          <div className="medio">
            <span className="nombre">{c.nombre}</span>
            <span className="mini">
              {c.fuente === 'api' ? (c.sync_error ? 'Automática · con error, podés cargarlo a mano' : `Automática · ${hace(c.actualizado_at)}`) : `Manual · ${hace(c.actualizado_at)}`}
            </span>
          </div>
          <span className="monto"><Monto n={c.saldo} moneda={c.moneda} /></span>
          <button className="btn-icono sin-borde" onClick={() => setEditando(c)} aria-label={`Cargar saldo de ${c.nombre}`}><Lapiz /></button>
        </div>
      ))}

      <Hoja abierta={!!editando} onCerrar={() => setEditando(null)} titulo={`Saldo de ${editando?.nombre || ''}`}>
        {editando && (
          <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="hidden" name="cuenta_id" value={editando.id} />
            <div className="campo">
              <label htmlFor="saldo">Saldo actual {editando.moneda === 'USD' ? '(US$)' : '($)'}</label>
              <input id="saldo" name="saldo" className="monto-grande" inputMode="decimal" defaultValue={editando.saldo} autoFocus />
            </div>
            {editando.fuente === 'api' && <p className="mini">Se va a reemplazar en la próxima sincronización que funcione.</p>}
            {error && <p className="error-form">{error}</p>}
            <button className="btn" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar saldo'}</button>
          </form>
        )}
      </Hoja>
    </>
  );
}

export function EditarPresupuesto({ actual }) {
  const [abierta, setAbierta] = useState(false);
  const { pendiente, error, enviar } = useAccion(guardarPresupuesto, { alTerminar: () => setAbierta(false) });
  return (
    <>
      <button className="link-btn" onClick={() => setAbierta(true)}>Editar</button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Presupuesto mensual">
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="campo">
            <label htmlFor="presupuesto">Cuánto quieren gastar por mes (sin contar ahorro ni transferencias)</label>
            <input id="presupuesto" name="presupuesto" className="monto-grande" inputMode="decimal" defaultValue={actual || ''} autoFocus />
          </div>
          {error && <p className="error-form">{error}</p>}
          <button className="btn" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </Hoja>
    </>
  );
}
