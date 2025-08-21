import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeStopLossAndTiming } from '@/lib/sl-analyzer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json();
    const { predictionId, tradeId, outcome, reason } = body || {};
    if (!predictionId && !tradeId) return NextResponse.json({ success: false, error: 'predictionId or tradeId required' }, { status: 400 });

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    // locate context
    const prediction = predictionId ? await prisma.tradePrediction.findUnique({ where: { id: predictionId } }) : null;
    const trade = tradeId ? await prisma.trade.findUnique({ where: { id: tradeId } }) : null;

    const created = await prisma.feedbackEvent.create({
      data: {
        agentId,
        predictionId: prediction?.id ?? null,
        tradeId: trade?.id ?? null,
        outcome,
        reason,
      },
    });

    const base = prediction ?? trade;
    if (!base) return NextResponse.json({ success: true, event: created, analysis: null });

    const analysis = await analyzeStopLossAndTiming({
      agentId,
      strategyId: prediction?.strategyId ?? trade!.strategyId,
      symbol: prediction?.symbol ?? trade!.symbol,
      timeframe: prediction?.timeframe ?? (trade as any).timeframe ?? '1h',
      timestamp: prediction?.timestamp ?? trade!.entryTime,
      action: (prediction?.action as any) ?? (trade ? (trade.action === 'buy' ? 'buy' : 'sell') : undefined),
      outcome: (outcome?.result as any) ?? undefined,
      pnlPct: outcome?.pnlPct,
    });

    return NextResponse.json({ success: true, event: created, analysis });
  } catch (error) {
    console.error('Feedback post failed:', error);
    return NextResponse.json({ success: false, error: 'Feedback failed' }, { status: 500 });
  }
}
