// Cliente de la API oficial de Mercado Pago (solo servidor).
const MP = 'https://api.mercadopago.com';

async function mp(path) {
  const res = await fetch(`${MP}${path}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} en ${path.split('?')[0]}`);
  return res.json();
}

export async function leerMercadoPago() {
  if (!process.env.MP_ACCESS_TOKEN) return null;

  const me = await mp('/users/me');

  // Saldo: confirmá este endpoint en la referencia de Mercado Pago Developers.
  let saldo = null;
  try {
    const bal = await mp(`/users/${me.id}/mercadopago_account/balance`);
    saldo = Number(bal.available_balance ?? bal.total_amount ?? 0);
  } catch {
    saldo = null; // si falla, se mantiene el último saldo conocido
  }

  // Últimos pagos (enviados y recibidos)
  const busq = await mp('/v1/payments/search?sort=date_created&criteria=desc&limit=50');
  const movimientos = (busq.results || [])
    .filter((p) => p.status === 'approved')
    .map((p) => {
      const recibido = p.collector_id === me.id;
      const monto = Number(p.transaction_amount || 0) * (recibido ? 1 : -1);
      return {
        id: `mp:${p.id}`,
        fecha: String(p.date_approved || p.date_created).slice(0, 10),
        descripcion: p.description || (recibido ? 'Cobro Mercado Pago' : 'Pago Mercado Pago'),
        monto,
      };
    });

  return { saldo, movimientos };
}
