import { NextRequest, NextResponse } from 'next/server';

import { getBalance, getTickerPrice } from '@/lib/broker';
import { CONFIG } from '@/lib/config';
import { prisma } from '@/lib/db';
import { BrokerJobData,defaultJobOpts, queues } from '@/lib/queue';
import { simpleSizeByQuote } from '@/lib/risk';

export const dynamic = 'force-dynamic';

// POST /api/execute/signal
// Body: { symbol: string, side: 'buy'|'sell', type?: 'market'|'limit', price?: number, riskPct?: number }
// Uses CONFIG to size the order from quote balance. Enqueues broker_exec job.
export async function POST(req: NextRequest) {
  try {
    if (!CONFIG.EXECUTION_ENABLED) {
      return NextResponse.json({ ok: false, error: 'Execution disabled. Set EXECUTION_ENABLED=true in env.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { symbol, side, type = 'market', price: priceInput, riskPct, agentId, strategyId, stopLoss, takeProfit } = body || {};
    if (!symbol || !side) {
      return NextResponse.json({ ok: false, error: 'symbol and side are required' }, { status: 400 });
    }

    // Optional: pre-trade exposure guard (avoid duplicate positions)
    if (agentId && strategyId) {
      try {
        const openSameSide = await prisma.trade.findFirst({
          where: { agentId, strategyId, symbol, status: 'open', action: side },
        } as any);
        if (openSameSide) {
          return NextResponse.json({ ok: false, error: 'Open position exists in the same direction for this agent/strategy/symbol' }, { status: 409 });
        }
        const pendingSameSide = await (prisma as any).pendingOrder.findFirst({
          where: { agentId, strategyId, symbol, side },
        });
        if (pendingSameSide) {
          return NextResponse.json({ ok: false, error: 'Pending order already exists in the same direction for this agent/strategy/symbol' }, { status: 409 });
        }
      } catch {}
    }

    // Determine price
    const mktPrice = await getTickerPrice(symbol);
    const px = type === 'market' ? mktPrice : Number(priceInput);
    if (type === 'limit' && !Number.isFinite(px)) {
      return NextResponse.json({ ok: false, error: 'price is required for limit orders' }, { status: 400 });
    }

    // Fetch quote balance (e.g., USDT)
    const bal = await getBalance();
    const quote = CONFIG.QUOTE_CURRENCY;
    const freeQuote = (bal?.free?.[quote] ?? (bal?.total?.[quote] ?? 0) - (bal?.used?.[quote] ?? 0)) as number;

    // Size order by risk percent of quote
    const amount = simpleSizeByQuote({ quoteBalance: Number(freeQuote || 0), riskPct: Number(riskPct), price: px });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'Calculated amount is zero. Check balance and risk.' }, { status: 400 });
    }

    const job: BrokerJobData = {
      action: 'place',
      symbol,
      side,
      type,
      amount,
      price: type === 'limit' ? px : undefined,
      agentId: agentId || undefined,
      strategyId: strategyId || undefined,
      stopLoss: stopLoss != null ? Number(stopLoss) : undefined,
      takeProfit: takeProfit != null ? Number(takeProfit) : undefined,
    } as any;
    const enq = await queues.broker_exec.add('place_order', job, defaultJobOpts);

    return NextResponse.json({ ok: true, jobId: enq.id, sized: { amount, price: px, quote: { currency: quote, free: freeQuote } } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
