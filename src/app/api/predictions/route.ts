import { NextRequest, NextResponse } from 'next/server';
import { CONFIG } from '@/lib/config';

// POST /api/predictions
// Body: { agentId, strategyId, symbol, timeframe, timestamp, action: 'buy'|'sell'|'hold', confidence: number, meta? }
// If EXECUTION_ENABLED and confidence >= PREDICTION_MIN_CONF and symbol not in DO_NOT_TRADE and cooldown ok:
// Triggers /api/execute/signal with side=action (if buy/sell)

const lastFired: Record<string, number> = {};

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { agentId, strategyId, symbol, timeframe, timestamp, action, confidence, meta, stopLoss, takeProfit } = body || {};
    if (!agentId || !strategyId || !symbol || !action || typeof confidence !== 'number') {
      return NextResponse.json({ ok: false, error: 'agentId, strategyId, symbol, action, confidence are required' }, { status: 400 });
    }

    // Basic rules
    if (!CONFIG.EXECUTION_ENABLED) return NextResponse.json({ ok: true, routed: false, reason: 'execution_disabled' });
    if (CONFIG.DO_NOT_TRADE.includes(symbol)) return NextResponse.json({ ok: true, routed: false, reason: 'do_not_trade' });
    if (confidence < CONFIG.PREDICTION_MIN_CONF) return NextResponse.json({ ok: true, routed: false, reason: 'below_confidence' });

    // Cooldown per agent/strategy/symbol
    const key = `${agentId}:${strategyId}:${symbol}:${action}`;
    const now = Date.now();
    const last = lastFired[key] || 0;
    if (now - last < CONFIG.PREDICTION_COOLDOWN_SEC * 1000) {
      return NextResponse.json({ ok: true, routed: false, reason: 'cooldown' });
    }

    if (action !== 'buy' && action !== 'sell') {
      return NextResponse.json({ ok: true, routed: false, reason: 'noop_action' });
    }

    // Route to execute/signal
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/execute/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, side: action, agentId, strategyId, stopLoss, takeProfit })
    });
    const json = await res.json();
    lastFired[key] = now;
    return NextResponse.json({ ok: true, routed: true, exec: json });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
