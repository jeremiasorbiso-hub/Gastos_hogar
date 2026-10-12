import { Monto } from './Privacidad';

// Una fila de movimiento (se usa en Inicio y Movimientos)
export default function FilaMovimiento({ m, quien, extra, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="fila" onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="avatar chico" style={{ background: quien?.color || '#8A958F' }} title={quien?.nombre || 'Banco'}>
        {quien?.inicial || '·'}
      </span>
      <span className="medio">
        <span className="nombre">{m.descripcion}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mini">{m.categoria}{extra ? ` · ${extra}` : ''}</span>
          <span className={`sello ${m.origen === 'manual' ? 'manual' : ''}`}>
            {m.origen === 'manual' ? 'Manual' : m.origen === 'mercadopago' ? 'MP' : 'Banco'}
          </span>
        </span>
      </span>
      <span className={`monto ${Number(m.monto) > 0 ? 'ingreso' : ''}`}><Monto n={m.monto} signo /></span>
    </Tag>
  );
}
