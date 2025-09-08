import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { queues, defaultJobOpts, RLJobData } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      agentId,
      symbol = 'BTC/USDT',
      timeframe = '1h',
      window = 64,
      hparams = {},
      episode = {},
      trainSeconds = 60,
    } = body as Partial<RLJobData> & { agentId: string };

    if (!agentId) return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 });

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const run = await prisma.trainingRun.create({ data: { agentId, runType: 'rl', status: 'running', params: { symbol, timeframe, window, hparams, episode } } });

    const job = await queues.train_rl.add(
      'rl_train',
      { runId: run.id, agentId, symbol, timeframe, window, hparams, episode, trainSeconds },
      defaultJobOpts
    );

    await prisma.agent.update({ where: { id: agentId }, data: { performance: { ...(agent.performance as any), status: 'training', jobId: job.id } } });

    return NextResponse.json({ success: true, runId: run.id, jobId: job.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
