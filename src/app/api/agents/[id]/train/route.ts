import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { trainSupervised } from '@/lib/supervised-trainer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json().catch(() => ({}));
    const {
      symbol = 'BTC_USDT',
      timeframe = '1h',
      lookback = 128,
      lookahead = 8,
      epochs = 8,
      batchSize = 64,
      limit = 5000,
    } = body || {};

    const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { strategy: true } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const result = await trainSupervised({
      agentId,
      strategyId: agent.strategyId,
      symbol,
      timeframe,
      lookback,
      lookahead,
      epochs,
      batchSize,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Supervised train failed:', error);
    return NextResponse.json({ success: false, error: 'Training failed' }, { status: 500 });
  }
}
