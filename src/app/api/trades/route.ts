import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId') || undefined;
    const strategyId = searchParams.get('strategyId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (strategyId) where.strategyId = strategyId;
    if (status) where.status = status as any;

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { entryTime: 'desc' },
      take: limit,
      include: { agent: true, strategy: true },
    });

    return NextResponse.json({ success: true, trades });
  } catch (e: any) {
    console.error('GET /api/trades failed', e);
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
