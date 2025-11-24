import { NextRequest, NextResponse } from 'next/server';

import { getOpenOrders } from '@/lib/broker';
import { BrokerJobData,defaultJobOpts, queues } from '@/lib/queue';

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

// POST /api/broker/orders - place order
// Body: { symbol, side: 'buy'|'sell', type: 'market'|'limit', amount, price?, params?, agentId?, strategyId?, stopLoss?, takeProfit? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { symbol, side, type, amount, price, params, agentId, strategyId, stopLoss, takeProfit } = body || {};
    if (!symbol || !side || !type || !amount) {
      return NextResponse.json({ ok: false, error: 'symbol, side, type, amount are required' }, { status: 400 });
    }

    const job: BrokerJobData = {
      action: 'place',
      symbol,
      side,
      type,
      amount: Number(amount),
      price: price != null ? Number(price) : undefined,
      params,
      agentId: agentId || undefined,
      strategyId: strategyId || undefined,
      stopLoss: stopLoss != null ? Number(stopLoss) : undefined,
      takeProfit: takeProfit != null ? Number(takeProfit) : undefined,
    } as any;
    const enq = await queues.broker_exec.add('place_order', job, defaultJobOpts);
    return NextResponse.json({ ok: true, jobId: enq.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}

// DELETE /api/broker/orders - cancel order
// Body: { orderId, symbol, params? }
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, symbol, params } = body || {};
    if (!orderId || !symbol) {
      return NextResponse.json({ ok: false, error: 'orderId and symbol are required' }, { status: 400 });
    }

    const job: BrokerJobData = { action: 'cancel', orderId, symbol, params } as any;
    const enq = await queues.broker_exec.add('cancel_order', job, defaultJobOpts);
    return NextResponse.json({ ok: true, jobId: enq.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
