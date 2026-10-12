'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hoja, useAccion } from './Hoja';
import { Monto } from './Privacidad';
import FilaMovimiento from './FilaMovimiento';
import { Mas } from './Iconos';
import { agregarMovimiento, recategorizar, borrarMovimiento } from '@/app/actions';
import { etiquetaDia, hoyAR, CATEGORIAS_GASTO, NO_ES_GASTO, patronDe } from '@/lib/format';

export default function MovimientosCliente({ movs, cuentas, miembros, yo, categorias, filtro, abrirNuevo, mes }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState(abrirNuevo);
  const [editando, setEditando] = useState(null);

  const quien = useMemo(() => Object.fromEntries(miembros.map((x) => [x.email.toLowerCase(), x])), [miembros]);

  const visibles = filtro === 'Todos' ? movs : movs.filter((x) => x.categoria === filtro);
  const grupos = useMemo(() => {
    const g = [];
    for (const x of visibles) {
      const dia = etiquetaDia(x.fecha);
      let ult = g[g.length - 1];
      if (!ult || ult.dia !== dia) { ult = { dia, items: [] }; g.push(ult); }
      ult.items.push(x);
    }
    return g;
  }, [visibles]);

  let entro = 0, salio = 0;
  for (const x of movs) {
    const n = Number(x.monto);
    if (n > 0 && x.categoria === 'Ingreso') entro += n;
    if (n < 0 && !NO_ES_GASTO.includes(x.categoria)) salio += -n;
  }

  const usadas = ['Todos', ...categorias.filter((c) => movs.some((x) => x.categoria === c))];
  const qs = (extra) => {
    const p = new URLSearchParams({ mes: mes.actual, ...extra });
    if (p.get('cat') === 'Todos') p.delete('cat');
    return `/movimientos?${p}`;
  };

  const cerrarNuevo = () => {
    setNuevo(false);
    if (abrirNuevo) router.replace(qs(filtro !== 'Todos' ? { cat: filtro } : {}), { scroll: false });
  };

  return (
    <>
      <header className="encabezado">
        <div>
          <p className="sub">
            <Link href={qs({ mes: mes.anterior })} aria-label="Mes anterior" style={{ textDecoration: 'none', padding: '8px 8px 8px 0' }}>‹</Link>
            {mes.titulo}
            {mes.siguiente && <Link href={qs({ mes: mes.siguiente })} aria-label="Mes siguiente" style={{ textDecoration: 'none', padding: 8 }}>›</Link>}
          </p>
          <h1 className="titulo">Movimientos</h1>
        </div>
      </header>

      <div className="resumen">
        <div><span className="mini">Entró</span><b style={{ color: 'var(--acento)' }}><Monto n={entro} /></b></div>
        <div><span className="mini">Salió (gastos)</span><b><Monto n={salio} /></b></div>
      </div>

      <div className="chips desliza">
        {usadas.map((c) => (
          <Link key={c} href={qs({ cat: c })} className={`chip ${filtro === c ? 'on' : ''}`} scroll={false}>{c}</Link>
        ))}
      </div>

      {grupos.length === 0 && <p className="vacio" style={{ marginTop: 24 }}>No hay movimientos{filtro !== 'Todos' ? ` de ${filtro}` : ''} en este mes.</p>}

      {grupos.map((g) => (
        <section key={g.dia} className="grupo-dia">
          <h2>{g.dia}</h2>
          <div className="tarjeta lista" style={{ margin: 0 }}>
            {g.items.map((x) => (
              <FilaMovimiento key={x.id} m={x} quien={quien[x.cargado_por?.toLowerCase()]} onClick={() => setEditando(x)} />
            ))}
          </div>
        </section>
      ))}

      <button className="fab" onClick={() => setNuevo(true)} aria-label="Agregar movimiento"><Mas /></button>

      <NuevoMovimiento abierta={nuevo} onCerrar={cerrarNuevo} cuentas={cuentas} miembros={miembros} yo={yo} />
      <EditarMovimiento mov={editando} onCerrar={() => setEditando(null)} categorias={categorias} />
    </>
  );
}

function NuevoMovimiento({ abierta, onCerrar, cuentas, miembros, yo }) {
  const [tipo, setTipo] = useState('gasto');
  const [cat, setCat] = useState('Súper');
  const [cargo, setCargo] = useState(yo);
  const { pendiente, error, enviar } = useAccion(agregarMovimiento, { alTerminar: onCerrar });
  const cuentasArs = cuentas.filter((c) => c.moneda === 'ARS');

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Nuevo movimiento">
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="categoria" value={cat} />
        <input type="hidden" name="cargado_por" value={cargo} />

        <div className="segmento">
          <button type="button" className={tipo === 'gasto' ? 'on' : ''} onClick={() => setTipo('gasto')}>Gasto</button>
          <button type="button" className={tipo === 'ingreso' ? 'on' : ''} onClick={() => setTipo('ingreso')}>Ingreso</button>
        </div>

        <div className="campo">
          <label htmlFor="monto">Monto</label>
          <input id="monto" name="monto" className="monto-grande" inputMode="decimal" placeholder="$ 0" required autoFocus />
        </div>

        <div className="campo">
          <label htmlFor="descripcion">Descripción</label>
          <input id="descripcion" name="descripcion" placeholder="Ej: verdulería" />
        </div>

        {tipo === 'gasto' && (
          <div className="campo">
            <span className="etq">Categoría</span>
            <div className="chips">
              {CATEGORIAS_GASTO.map((c) => (
                <button key={c} type="button" className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
        )}

        <div className="dos">
          <div className="campo">
            <label htmlFor="cuenta_id">Cuenta</label>
            <select id="cuenta_id" name="cuenta_id" defaultValue={cuentasArs.find((c) => c.nombre === 'Efectivo')?.id || ''}>
              <option value="">Sin cuenta</option>
              {cuentasArs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fecha">Fecha</label>
            <input id="fecha" name="fecha" type="date" defaultValue={hoyAR().iso} />
          </div>
        </div>

        <div className="campo">
          <span className="etq">Lo cargó</span>
          <div className="chips">
            {miembros.map((x) => (
              <button key={x.email} type="button" className={`chip ${cargo === x.email ? 'on' : ''}`} onClick={() => setCargo(x.email)}>{x.nombre}</button>
            ))}
          </div>
        </div>

        <p className="mini">Los movimientos del banco entran solos. Usá esto para efectivo o lo que no aparezca.</p>
        {error && <p className="error-form">{error}</p>}
        <button className="btn" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Hoja>
  );
}

function EditarMovimiento({ mov, onCerrar, categorias }) {
  const [cat, setCat] = useState(null);
  const [todos, setTodos] = useState(true);
  const guardar = useAccion(recategorizar, { alTerminar: cerrar });
  const borrar = useAccion(borrarMovimiento, { alTerminar: cerrar });

  function cerrar() { setCat(null); setTodos(true); onCerrar(); }
  const actual = cat ?? mov?.categoria;

  return (
    <Hoja abierta={!!mov} onCerrar={cerrar} titulo={mov?.descripcion || ''}>
      {mov && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="mini">
            {etiquetaDia(mov.fecha)} · <Monto n={mov.monto} signo /> · {mov.origen === 'manual' ? 'cargado a mano' : 'importado automáticamente'}
          </p>
          <div className="campo">
            <span className="etq">Categoría</span>
            <div className="chips">
              {categorias.map((c) => (
                <button key={c} type="button" className={`chip ${actual === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          {mov.origen !== 'manual' && (
            <label className="check-campo">
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
              Aplicar a todos los de &ldquo;{patronDe(mov.descripcion)}&rdquo; (y los que vengan)
            </label>
          )}
          {(guardar.error || borrar.error) && <p className="error-form">{guardar.error || borrar.error}</p>}
          <button className="btn" disabled={guardar.pendiente || actual === mov.categoria}
            onClick={() => guardar.correr({ id: mov.id, categoria: actual, aplicarATodos: mov.origen !== 'manual' && todos })}>
            {guardar.pendiente ? 'Guardando…' : 'Guardar categoría'}
          </button>
          {mov.origen === 'manual' && (
            <button className="btn peligro" disabled={borrar.pendiente} onClick={() => borrar.correr(mov.id)}>
              {borrar.pendiente ? 'Borrando…' : 'Borrar movimiento'}
            </button>
          )}
        </div>
      )}
    </Hoja>
  );
}
