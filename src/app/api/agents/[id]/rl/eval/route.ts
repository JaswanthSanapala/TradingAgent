import { NextRequest, NextResponse } from 'next/server';
import * as tf from '@tensorflow/tfjs-node';
import { loadLatestCheckpoint, inferAction } from '@/lib/rl-infer';
import { TradingEnv, EnvConfig } from '@/lib/rl-env';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = params.id;
    const body = await req.json();
    const { symbol = 'BTC_USDT', timeframe = '1h', window = 64, steps = 1000 }: Partial<EnvConfig> & { steps?: number } = body || {} as any;

    const ckptDir = `data/models/agents/${agentId}/ppo/v1`;
    const model = await loadLatestCheckpoint(ckptDir);

    const env = new TradingEnv({ symbol, timeframe, window, episode: { steps } } as any);
    await env.load();
    let state = env.reset();

    let totalReward = 0;
    let done = false;
    let t = 0;
    while (!done && t < steps) {
      const { action } = await inferAction(model, state, window);
      const step = env.step(action as any);
      totalReward += step.reward;
      state = step.state;
      done = step.done;
      t++;
    }

    return NextResponse.json({ ok: true, totalReward, steps: t });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'eval failed' }, { status: 500 });
  }
}
