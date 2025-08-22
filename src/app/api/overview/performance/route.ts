import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    // Use raw SQL for SQLite to aggregate by date and month
    const daily = await prisma.$queryRaw<{ day: string; pnl: number | null; trades: number }[]>`
      SELECT date(exitTime) as day, SUM(COALESCE(pnl, 0)) as pnl, COUNT(*) as trades
      FROM Trade
      WHERE exitTime IS NOT NULL
      GROUP BY date(exitTime)
      ORDER BY day DESC
      LIMIT 5
    `;

    const monthly = await prisma.$queryRaw<{ month: string; pnl: number | null; trades: number }[]>`
      SELECT strftime('%Y-%m', exitTime) as month, SUM(COALESCE(pnl, 0)) as pnl, COUNT(*) as trades
      FROM Trade
      WHERE exitTime IS NOT NULL
      GROUP BY strftime('%Y-%m', exitTime)
      ORDER BY month DESC
      LIMIT 5
    `;

    return NextResponse.json({
      success: true,
      daily: (daily || []).map(r => ({ date: r.day, pnl: Number(r.pnl || 0), trades: Number(r.trades || 0) })),
      monthly: (monthly || []).map(r => ({ month: r.month, pnl: Number(r.pnl || 0), trades: Number(r.trades || 0) })),
    });
  } catch (e: any) {
    console.error('GET /api/overview/performance failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
