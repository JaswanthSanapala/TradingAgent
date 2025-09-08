import { NextRequest, NextResponse } from 'next/server';
import { queues, defaultJobOpts, BrokerJobData } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// POST /api/broker/order
// Body: { symbol, side: 'buy'|'sell', type: 'market'|'limit', amount, price?, params? }
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
