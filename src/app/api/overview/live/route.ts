import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const trades = await prisma.trade.findMany({
      where: { status: 'open' as any },
      orderBy: { entryTime: 'desc' },
      take: 20,
      include: { agent: true, strategy: true },
    });

    return NextResponse.json({ success: true, trades });
  } catch (e: any) {
    console.error('GET /api/overview/live failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
