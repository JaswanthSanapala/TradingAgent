import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol'); // storage format e.g., BTC_USDT
    const timeframe = searchParams.get('timeframe');
    const to = searchParams.get('to'); // ISO string optional
    const limit = Math.min(Number(searchParams.get('limit') || 200), 2000);

    if (!symbol || !timeframe) {
      return NextResponse.json({ success: false, error: 'symbol and timeframe are required' }, { status: 400 });
    }

    const where: any = { symbol, timeframe };
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) where.timestamp = { lte: toDate };
    }

    const rows = await prisma.marketData.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { indicators: true },
    });

    const data = rows
      .map((r) => ({
        timestamp: r.timestamp,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
        ...((r as any).indicators?.[0] || {}),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('ohlcv failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
