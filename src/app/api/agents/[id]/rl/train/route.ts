import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PPOTrainer, PPOHyperParams } from '@/lib/rl-trainer';
import { EnvConfig } from '@/lib/rl-env';

const trainers = (global as any).__ppo_trainers__ as Map<string, PPOTrainer> || new Map<string, PPOTrainer>();
(global as any).__ppo_trainers__ = trainers;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = params.id;
    const body = await req.json();
    const { datasetId, symbol: bodySymbol = 'BTC_USDT', timeframe: bodyTimeframe = '1h', window = 64, episodeSteps = 2048, hparams }: { datasetId?: string; symbol?: string; timeframe?: string; window?: number; episodeSteps?: number; hparams?: Partial<PPOHyperParams> } = body || {};

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });

    // Resolve dataset if datasetId provided
    let symbol = bodySymbol;
    let timeframe = bodyTimeframe;
    if (datasetId) {
      const m = await prisma.coverageManifest.findUnique({ where: { id: datasetId } });
      if (!m) return NextResponse.json({ ok: false, error: 'Dataset not found' }, { status: 404 });
      symbol = m.symbol;
      timeframe = m.timeframe;
    }

    const envCfg: EnvConfig = { symbol, timeframe, window, episode: { steps: episodeSteps } } as any;
    const hp: PPOHyperParams = {
      gamma: 0.99,
      gaeLambda: 0.95,
      clipRatio: 0.2,
      entropyCoef: 0.01,
      valueCoef: 0.5,
      lr: 1e-4,
      rolloutSteps: 512,
      batchSize: 512,
      minibatchSize: 128,
      epochs: 4,
      ...(hparams || {}),
    };

    const run = await prisma.trainingRun.create({ data: { agentId, runType: 'rl', params: { envCfg, hp, datasetId: datasetId || null }, status: 'running' } });

    let trainer = trainers.get(agentId);
    if (!trainer) {
      trainer = new PPOTrainer({ agentId, envCfg, hparams: hp });
      trainers.set(agentId, trainer);
    }

    // fire and forget
    trainer.start({ trainingRunId: run.id }).then(async () => {
      await prisma.trainingRun.update({ where: { id: run.id }, data: { status: 'completed' } });
    }).catch(async (e) => {
      await prisma.trainingRun.update({ where: { id: run.id }, data: { status: 'failed', metrics: { error: String(e?.message || e) } } });
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
