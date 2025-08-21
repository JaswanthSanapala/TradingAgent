import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loadLatestCheckpoint, inferAction } from '@/lib/rl-infer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = params.id;
    const body = await req.json();
    const { state, window = 64, symbol, timeframe, timestamp, strategyId }: { state: number[]; window?: number; symbol?: string; timeframe?: string; timestamp?: string; strategyId?: string } = body || {};
    if (!state) return NextResponse.json({ ok: false, error: 'state required' }, { status: 400 });

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

    return NextResponse.json({ ok: true, action, confidence, logits, predictionId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'predict failed' }, { status: 500 });
  }
}
