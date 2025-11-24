import { Job,Worker } from 'bullmq';

import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { makeRLMetrics } from '@/lib/trading/metrics';
import { promote, prune,registerArtifact } from '@/lib/ml/model-registry';
import { connection, RLJobData } from '@/lib/queue';
import type { EnvConfig } from '@/lib/ml/rl-env';
import { PPOHyperParams,PPOTrainer } from '@/lib/ml/rl-trainer';
import { socketBus, TRAIN_PROGRESS_EVENT } from '@/lib/socket-bus';

const log = createLogger('RLWorker');

let started = false;

export function startRLWorker() {
  if (started) return;
  started = true;

  const worker = new Worker<RLJobData>(
    'train_rl',
    async (job: Job<RLJobData>) => {
      const data = job.data;
      const { agentId, runId, symbol, timeframe, window, hparams, episode, trainSeconds } = data;

      log.info('Starting RL training job', { jobId: job.id, agentId, runId, symbol, timeframe, window });

      // Ensure TrainingRun exists/mark as running
      if (runId) {
        await prisma.trainingRun.update({ where: { id: runId }, data: { status: 'running', runType: 'rl' } });
      }

      // Default PPO hyperparams
      const hp: PPOHyperParams = {
        gamma: hparams?.gamma ?? 0.99,
        gaeLambda: hparams?.gaeLambda ?? 0.95,
        clipRatio: hparams?.clipRatio ?? 0.2,
        entropyCoef: hparams?.entropyCoef ?? 0.01,
        valueCoef: hparams?.valueCoef ?? 0.5,
        lr: hparams?.lr ?? 3e-4,
        rolloutSteps: hparams?.rolloutSteps ?? 2048,
        batchSize: hparams?.batchSize ?? 2048,
        minibatchSize: hparams?.minibatchSize ?? 256,
        epochs: hparams?.epochs ?? 10,
      };

      const envCfg: EnvConfig = {
        symbol,
        timeframe,
        window,
        episode: episode || {},
      };

      const trainer = new PPOTrainer({ agentId, envCfg, hparams: hp });

      // Stop after trainSeconds wall-clock time if provided
      let timeout: NodeJS.Timeout | null = null;
      const t0 = Date.now();
      try {
        if (trainSeconds && trainSeconds > 0) {
          timeout = setTimeout(() => {
            log.info('Auto-stopping RL job due to trainSeconds', { trainSeconds });
            trainer.stop();
          }, Math.max(1, trainSeconds) * 1000);
        }

        await trainer.start({ trainingRunId: runId });

        // Save final checkpoint directory into Agent if exists
        const status = trainer.status();
        if (status?.ckptDir) {
          try {
            await prisma.agent.update({ where: { id: agentId }, data: { modelPath: status.ckptDir } });
          } catch {}

          // Register RL artifact in model registry
          try {
            const version = status.ckptDir.split('/').slice(-1)[0] || status.ckptDir;
            registerArtifact({ agentId, version, dir: status.ckptDir, type: 'rl', metrics: { steps: status.step } });
            promote({ agentId, version, stage: 'latest' });
            prune({ agentId, keep: 5 });
          } catch {}
        }

        if (runId) {
          const wallTimeSec = Math.max(0, Math.round((Date.now() - t0) / 1000));
          await prisma.trainingRun.update({ where: { id: runId }, data: { status: 'completed', metrics: makeRLMetrics({ steps: status.step, avgReward: status.avgReward, policyLoss: status.policyLoss, valueLoss: status.valueLoss, entropy: status.entropy, wallTimeSec, artifactPath: status.ckptDir, algorithm: 'rl/ppo' }), artifactPath: status.ckptDir } });
        }

        return { ok: true };
      } catch (err: any) {
        log.error('RL training job failed', { error: err?.message });
        socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'error', message: String(err?.message || err), ts: new Date().toISOString() });
        if (runId) {
          const status = trainer.status();
          const wallTimeSec = Math.max(0, Math.round((Date.now() - t0) / 1000));
          await prisma.trainingRun.update({ where: { id: runId }, data: { status: 'failed', metrics: { ...makeRLMetrics({ steps: status.step, avgReward: status.avgReward, policyLoss: status.policyLoss, valueLoss: status.valueLoss, entropy: status.entropy, wallTimeSec, artifactPath: status.ckptDir, algorithm: 'rl/ppo' }), error: String(err?.message || err) } } });
        }
        throw err;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
    { connection }
  );

  worker.on('completed', (job) => log.info('RL job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => log.error('RL job failed', { jobId: job?.id, error: err?.message }));

  log.info('RL worker started');
}
