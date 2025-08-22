import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { socketBus, PREDICTION_UPDATED_EVENT, TRADE_CREATED_EVENT } from '@/lib/socket-bus';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json().catch(() => ({}));
    const action: 'accept' | 'reject' | 'note' | undefined = body?.action;
    if (!action) return NextResponse.json({ success: false, error: 'action required' }, { status: 400 });

    const prediction = await prisma.tradePrediction.findUnique({ where: { id } });
    if (!prediction) return NextResponse.json({ success: false, error: 'prediction not found' }, { status: 404 });

    const meta: any = prediction.meta || {};

    if (action === 'reject') {
      const updated = await prisma.tradePrediction.update({
        where: { id },
        data: { meta: { ...meta, status: 'rejected' } },
      });
      // emit updated event
      socketBus.emit(PREDICTION_UPDATED_EVENT, {
        id: updated.id,
        agentId: updated.agentId,
        strategyId: updated.strategyId,
        symbol: updated.symbol,
        timeframe: updated.timeframe,
        timestamp: updated.timestamp.toISOString(),
        action: updated.action,
        confidence: updated.confidence,
        stopLoss: updated.stopLoss ?? null,
        takeProfit: updated.takeProfit ?? null,
        meta: updated.meta,
      });
      return NextResponse.json({ success: true, prediction: updated });
    }

    if (action === 'note') {
      const noteText = String(body?.note || '').trim();
      const updated = await prisma.tradePrediction.update({
        where: { id },
        data: { meta: { ...meta, notes: noteText } },
      });
      socketBus.emit(PREDICTION_UPDATED_EVENT, {
        id: updated.id,
        agentId: updated.agentId,
        strategyId: updated.strategyId,
        symbol: updated.symbol,
        timeframe: updated.timeframe,
        timestamp: updated.timestamp.toISOString(),
        action: updated.action,
        confidence: updated.confidence,
        stopLoss: updated.stopLoss ?? null,
        takeProfit: updated.takeProfit ?? null,
        meta: updated.meta,
      });
      return NextResponse.json({ success: true, prediction: updated });
    }

    // accept -> create Trade and mark prediction accepted
    const entryPrice = Number(meta?.price ?? 0) || Number((prediction as any)?.meta?.price ?? 0) || 0;
    const stopLoss = Number(prediction.stopLoss ?? meta?.stopLoss ?? 0);
    const takeProfit = Number(prediction.takeProfit ?? meta?.takeProfit ?? 0);
    const positionSize = Number(meta?.positionSize ?? 1);

    const trade = await prisma.trade.create({
      data: {
        agentId: prediction.agentId,
        strategyId: prediction.strategyId,
        entryTime: prediction.timestamp,
        entryPrice: entryPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        positionSize,
        action: prediction.action as any,
      },
    });

    const updated = await prisma.tradePrediction.update({
      where: { id },
      data: { meta: { ...meta, status: 'accepted', tradeId: trade.id } },
    });

    // emit prediction updated + trade created
    socketBus.emit(PREDICTION_UPDATED_EVENT, {
      id: updated.id,
      agentId: updated.agentId,
      strategyId: updated.strategyId,
      symbol: updated.symbol,
      timeframe: updated.timeframe,
      timestamp: updated.timestamp.toISOString(),
      action: updated.action,
      confidence: updated.confidence,
      stopLoss: updated.stopLoss ?? null,
      takeProfit: updated.takeProfit ?? null,
      meta: updated.meta,
    });

    socketBus.emit(TRADE_CREATED_EVENT, {
      id: trade.id,
      agentId: trade.agentId,
      strategyId: trade.strategyId,
      symbol: prediction.symbol,
      timeframe: prediction.timeframe,
      entryTime: trade.entryTime.toISOString(),
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      action: trade.action as any,
    });

    return NextResponse.json({ success: true, trade, prediction: updated });
  } catch (e: any) {
    console.error('prediction action failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
