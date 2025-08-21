import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { predictForAgent } from '@/lib/predictor';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'BTC_USDT';
    const timeframe = url.searchParams.get('timeframe') || '1h';
    const lookback = Number(url.searchParams.get('lookback') || 128);

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const prediction = await predictForAgent({
      agentId,
      strategyId: agent.strategyId,
      symbol,
      timeframe,
      lookback,
    });

    return NextResponse.json({ success: true, prediction });
  } catch (error) {
    console.error('Predict failed:', error);
    return NextResponse.json({ success: false, error: 'Predict failed' }, { status: 500 });
  }
}
