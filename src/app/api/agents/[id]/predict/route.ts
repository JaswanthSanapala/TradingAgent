import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { predictForAgent } from '@/lib/predictor';
import { loadLatestCheckpoint, inferAction } from '@/lib/rl-infer';

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json();
    const { state, window = 64, symbol, timeframe, timestamp, strategyId }: { state: number[]; window?: number; symbol?: string; timeframe?: string; timestamp?: string; strategyId?: string } = body || {};
    if (!state) return NextResponse.json({ success: false, error: 'state required for RL prediction' }, { status: 400 });

    const ckptDir = `data/models/agents/${agentId}/ppo/v1`;
    const model = await loadLatestCheckpoint(ckptDir);
    const { action, confidence, logits } = await inferAction(model, Float32Array.from(state), window);

    let predictionId: string | undefined = undefined;
    if (symbol && timeframe && timestamp && strategyId) {
      const pred = await prisma.tradePrediction.create({
        data: {
          agentId,
          strategyId,
          symbol,
          timeframe,
          timestamp: new Date(timestamp),
          features: {},
          action: action === 1 ? 'buy' : action === 2 ? 'sell' : 'hold',
          confidence,
        },
      });
      predictionId = pred.id;
    }

    return NextResponse.json({ success: true, action, confidence, logits, predictionId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'RL predict failed' }, { status: 500 });
  }
}
