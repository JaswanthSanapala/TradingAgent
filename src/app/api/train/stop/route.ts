import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { queues } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// POST /api/train/stop
// Body: { runId?: string, agentId?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { runId, agentId } = body as { runId?: string; agentId?: string };
    if (!runId && !agentId) return NextResponse.json({ success: false, error: 'runId or agentId is required' }, { status: 400 });

    // Resolve latest run if only agentId provided
    let run = runId
      ? await prisma.trainingRun.findUnique({ where: { id: runId } })
      : await prisma.trainingRun.findFirst({ where: { agentId: agentId! }, orderBy: { createdAt: 'desc' } });

    if (!run) return NextResponse.json({ success: false, error: 'TrainingRun not found' }, { status: 404 });

    // Attempt to remove job from queues if jobId is known on Agent.performance
    const agent = await prisma.agent.findUnique({ where: { id: run.agentId } });
    const perf: any = agent?.performance || {};
    const jobId: string | undefined = perf.jobId;

    if (jobId) {
      // Try all relevant queues where the job might reside
      const candidates = [
        queues.train_supervised,
        queues.train_rl,
        queues.data_backfill,
        queues.data_export,
        queues.data_windows,
        queues.coverage_tick,
      ];
      for (const q of candidates) {
        try {
          const job = await (q as any).getJob(jobId);
          if (job) {
            await job.remove();
            break;
          }
        } catch {}
      }
    }

    await prisma.trainingRun.update({ where: { id: run.id }, data: { status: 'failed', metrics: { ...(run.metrics as any), stoppedAt: new Date().toISOString() } } });
    if (agent) {
      await prisma.agent.update({ where: { id: agent.id }, data: { performance: { ...(agent.performance as any), status: 'stopped' } } });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
