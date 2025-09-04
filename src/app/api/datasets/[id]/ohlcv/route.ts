import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/datasets/:id/ohlcv
// Reads OHLCV (and indicators) for the dataset's storage symbol and timeframe.
// Query params:
//   to?: ISO string upper bound (optional)
//   limit?: max rows (default 200, max 2000)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ success: false, error: 'dataset id is required' }, { status: 400 });

    const dataset = await prisma.coverageManifest.findUnique({ where: { id } });
    if (!dataset) return NextResponse.json({ success: false, error: 'dataset not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to');
    const limit = Math.min(Number(searchParams.get('limit') || 200), 2000);

    const where: any = { symbol: dataset.symbol, timeframe: dataset.timeframe };
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

    return NextResponse.json({ success: true, data, symbol: dataset.symbol, timeframe: dataset.timeframe });
  } catch (e: any) {
    console.error('datasets/:id/ohlcv failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
