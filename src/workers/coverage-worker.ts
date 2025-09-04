import { Worker, Job, JobsOptions } from 'bullmq';
import { connection, queues, defaultJobOpts } from '@/lib/queue';
import { CoverageScheduler } from '@/lib/scheduler';
import { CONFIG } from '@/lib/config';

export function startCoverageWorker() {
  const worker = new Worker(
    'coverage_tick',
    async (_job: Job) => {
      await CoverageScheduler.instance.tick();
      return { ok: true };
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[coverage_tick] failed', job?.id, err);
  });

  return worker;
}

// Schedules a repeatable tick job; idempotent
export async function scheduleCoverageTick() {
  const every = CONFIG.SCHEDULER_TICK_MS || 15_000;
  const jobName = 'coverage_repeatable_tick';
  // Use a deterministic jobId so repeats don't duplicate on restarts
  await queues.coverage_tick.add(
    jobName,
    {},
    { ...defaultJobOpts, repeat: { every }, jobId: jobName }
  );
}
