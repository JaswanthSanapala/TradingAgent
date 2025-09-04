import { Worker, Job } from 'bullmq';
import { connection, SupervisedJobData } from '@/lib/queue';
import { prisma } from '@/lib/db';
import { trainSupervised, trainWalkForward } from '@/lib/supervised-trainer';
import { createLogger } from '@/lib/logger';

const log = createLogger('SupervisedWorker');

let started = false;

export function startSupervisedWorker() {
  if (started) return;
  started = true;

  const worker = new Worker<SupervisedJobData>(
    'train_supervised',
    async (job: Job<SupervisedJobData>) => {
      const data = job.data;
      const { agentId, strategyId, runId, walkForward, ...opts } = data;
      log.info('Starting supervised training job', { jobId: job.id, agentId, runId });

      // Ensure TrainingRun exists/mark as running
      if (runId) {
        await prisma.trainingRun.update({ where: { id: runId }, data: { status: 'running' } });
      }

      try {
        if (walkForward) {
          const wf = await trainWalkForward({
            agentId,
            strategyId,
            ...opts,
            folds: walkForward.folds,
            step: walkForward.step,
          } as any);
          if (runId) {
            await prisma.trainingRun.update({ where: { id: runId }, data: { metrics: wf.summary, status: 'completed' } });
          }
          return wf.summary;
        } else {
          const res = await trainSupervised({
            agentId,
            strategyId,
            ...opts,
          } as any);
          if (runId) {
            await prisma.trainingRun.update({ where: { id: runId }, data: { metrics: res.metrics, artifactPath: res.artifactPath, status: 'completed' } });
          }
          return res.metrics;
        }
      } catch (err: any) {
        log.error('Supervised training job failed', { error: err?.message });
        if (runId) {
          await prisma.trainingRun.update({ where: { id: runId }, data: { status: 'failed', metrics: { error: String(err?.message || err) } } });
        }
        throw err;
      }
    },
    { connection }
  );

  worker.on('completed', (job) => log.info('Job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => log.error('Job failed', { jobId: job?.id, error: err?.message }));

  log.info('Supervised worker started');
}
