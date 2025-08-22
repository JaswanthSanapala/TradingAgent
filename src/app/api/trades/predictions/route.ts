import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId') || undefined;
    const strategyId = searchParams.get('strategyId') || undefined;
    const symbol = searchParams.get('symbol') || undefined; // storage format e.g., BTC_USDT
    const timeframe = searchParams.get('timeframe') || undefined;
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);
    const latestOnly = (searchParams.get('latestOnly') || '').toLowerCase() === 'true';

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (strategyId) where.strategyId = strategyId;
    if (symbol) where.symbol = symbol;
    if (timeframe) where.timeframe = timeframe;

    const predictions = await prisma.tradePrediction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        agent: true,
        strategy: true,
      },
    });

    let result = predictions;
    // Optional status filtering via meta.status
    const status = (searchParams.get('status') || '').toLowerCase();
    const excludeStatus = (searchParams.get('excludeStatus') || '').toLowerCase();
    if (status) {
      result = result.filter((p: any) => (p?.meta?.status || '').toLowerCase() === status);
    }
    if (excludeStatus) {
      result = result.filter((p: any) => (p?.meta?.status || '').toLowerCase() !== excludeStatus);
    }

    if (latestOnly) {
      const seen = new Set<string>();
      const filtered: typeof predictions = [];
      for (const p of result) {
        const key = `${p.agentId}|${p.strategyId}|${p.symbol}|${p.timeframe}`;
        if (seen.has(key)) continue;
        seen.add(key);
        filtered.push(p);
      }
      result = filtered;
    }

    return NextResponse.json({ success: true, predictions: latestOnly ? result : (status || excludeStatus ? result : predictions) });
  } catch (e: any) {
    console.error('predictions list failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
