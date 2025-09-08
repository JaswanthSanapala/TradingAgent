import { NextRequest, NextResponse } from 'next/server';
import { getOpenOrders } from '@/lib/broker';

export const dynamic = 'force-dynamic';

// GET /api/broker/orders?symbol=BTC/USDT
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || undefined;
    const orders = await getOpenOrders(symbol);
    return NextResponse.json({ ok: true, orders });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
