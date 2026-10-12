import { NextResponse } from 'next/server';
import { sincronizarTodo } from '@/lib/sync/sincronizar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lo llama Vercel Cron (ver vercel.json) con "Authorization: Bearer CRON_SECRET".
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const r = await sincronizarTodo();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
