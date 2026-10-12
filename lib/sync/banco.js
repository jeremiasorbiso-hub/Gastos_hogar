// =========================================================
// Adaptador de TU API del banco
// =========================================================
// La app espera que esta función devuelva:
//   {
//     saldo: 1215900.50,
//     movimientos: [
//       { id: 'abc123', fecha: '2026-10-12', descripcion: 'COTO SUC 45', monto: -48230 },
//       ...
//     ]
//   }
// - monto NEGATIVO = gasto, POSITIVO = ingreso
// - id: algo único y estable por movimiento (si tu API no lo da, se arma uno)
//
// Si tu API devuelve otros nombres de campos, cambiá SOLO la función `mapear`.
// =========================================================

export async function leerBanco() {
  const url = process.env.BANK_API_URL;
  if (!url) return null; // sin API configurada: la cuenta queda en modo manual

  const headers = { Accept: 'application/json' };
  if (process.env.BANK_API_KEY) headers.Authorization = `Bearer ${process.env.BANK_API_KEY}`;

  const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`La API del banco respondió ${res.status}`);
  const json = await res.json();
  return mapear(json);
}

function mapear(json) {
  // 👇 Ajustá estos nombres a lo que devuelve tu scraper
  const saldo = num(json.saldo ?? json.balance ?? json.saldo_disponible);
  const lista = json.movimientos ?? json.transactions ?? json.items ?? [];

  const movimientos = lista.map((m) => {
    const fecha = normalizarFecha(m.fecha ?? m.date ?? m.fecha_operacion);
    const descripcion = String(m.descripcion ?? m.description ?? m.concepto ?? '').trim();
    let monto = num(m.monto ?? m.amount ?? m.importe);
    // Si tu banco separa débitos y créditos en dos columnas:
    if (m.debito != null || m.credito != null) monto = num(m.credito) - num(m.debito);
    const id = m.id ?? m.referencia ?? `${fecha}|${descripcion}|${monto}`;
    return { id: `banco:${id}`, fecha, descripcion, monto };
  }).filter((m) => m.fecha && m.descripcion && m.monto);

  return { saldo, movimientos };
}

// "1.234,56" → 1234.56 ; 1234.56 → 1234.56
function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[^\d,.\-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s) || 0;
}

// Acepta "2026-10-12", "12/10/2026" o "12/10/26"
function normalizarFecha(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}
