import { Queue, Worker, QueueEvents, JobsOptions, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

// Centralized BullMQ connection and queues
// REDIS_URL example: redis://localhost:6379
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export type QueueNames =
  | 'train_supervised'
  | 'train_rl'
  | 'ingestion'
  | 'predict'
  | 'broker_exec'
  | 'data_backfill'
  | 'data_export'
  | 'data_windows'
  | 'coverage_tick';

function makeQueue<T = any>(name: QueueNames) {
  return new Queue<T>(name, { connection: connection as unknown as ConnectionOptions });
}

export const queues = {
  train_supervised: makeQueue('train_supervised'),
  train_rl: makeQueue('train_rl'),
  ingestion: makeQueue('ingestion'),
  predict: makeQueue('predict'),
  broker_exec: makeQueue('broker_exec'),
  data_backfill: makeQueue('data_backfill'),
  data_export: makeQueue('data_export'),
  data_windows: makeQueue('data_windows'),
  coverage_tick: makeQueue('coverage_tick'),
};

export function createQueueEvents(name: QueueNames) {
  return new QueueEvents(name, { connection: connection as unknown as ConnectionOptions });
}

export type SupervisedJobData = {
  runId?: string;
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  lookback: number;
  lookahead: number;
  limit?: number;
  epochs?: number;
  batchSize?: number;
  labelingMode?: 'future_return' | 'imitation_strategy';
  strategySource?: any;
  ratios?: { train: number; val: number; test: number };
  walkForward?: { folds?: number; step?: number } | null;
};

export type BackfillJobData = {
  datasetId: string;
  from?: string; // ISO date
  to?: string;   // ISO date
};

export type ExportJobData = {
  datasetId: string;
  from?: string;
  to?: string;
};

export type WindowsJobData = {
  datasetId: string;
  from?: string;
  to?: string;
  windowSize: number;
  stride?: number;
  maskRatio?: number;
};

export const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 50,
  removeOnFail: 100,
};
