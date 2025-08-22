import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export async function GET(_req: NextRequest) {
  try {
    const now = new Date();
    const s = startOfDay(now);
    const e = endOfDay(now);

    // Daily PnL: sum pnl for trades exited today
    const todays = await prisma.trade.findMany({
      where: { exitTime: { gte: s, lte: e } },
      select: { pnl: true },
    });
    const dailyPnl = todays.reduce((acc, t) => acc + Number(t.pnl || 0), 0);

    // Win rate overall: pnl > 0 among trades with pnl not null
    const wins = await prisma.trade.count({ where: { pnl: { gt: 0 } } });
    const totalWithPnl = await prisma.trade.count({ where: { pnl: { not: null } } });
    const winRate = totalWithPnl > 0 ? wins / totalWithPnl : 0;

    // Pending predictions count using SQLite JSON extract
    const pendingPredRows = await prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*) as cnt FROM TradePrediction WHERE json_extract(meta, '$.status') = 'pending'
    `;
    const pendingPredictions = Number(pendingPredRows?.[0]?.cnt || 0);

    // Trades today: trades entered today (entryTime within today)
    const tradesToday = await prisma.trade.count({ where: { entryTime: { gte: s, lte: e } } });

    return NextResponse.json({ success: true, dailyPnl, winRate, pendingPredictions, tradesToday });
  } catch (e: any) {
    console.error('GET /api/overview/dashboard failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
