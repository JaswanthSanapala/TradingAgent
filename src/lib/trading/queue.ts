import { ConnectionOptions,JobsOptions, Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

import { CONFIG } from '@/lib/config';

// Centralized BullMQ connection and queues
const REDIS_URL = CONFIG.REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Lazy connection to avoid immediate connection attempts when Redis is disabled or down
export const connection = CONFIG.REDIS_ENABLED
  ? new IORedis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
  : (null as unknown as IORedis);

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
  if (!CONFIG.REDIS_ENABLED) {
    // Return a minimal stub that throws on usage, to make failures explicit without connecting
    const stub: any = {
      add: async () => {
        throw new Error('Redis is disabled. Set REDIS_ENABLED=true and configure REDIS_URL to use queues.');
      },
      addBulk: async () => {
        throw new Error('Redis is disabled.');
      },
    };
    return stub as Queue<T>;
  }
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
  if (!CONFIG.REDIS_ENABLED) {
    // Create a stub that throws upon usage
    throw new Error('Redis is disabled. Enable it to use QueueEvents.');
  }
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

// RL training job payload
export type RLJobData = {
  runId?: string;
  agentId: string;
  symbol: string;
  timeframe: string;
  window: number;
  hparams?: {
    gamma?: number;
    gaeLambda?: number;
    clipRatio?: number;
    entropyCoef?: number;
    valueCoef?: number;
    lr?: number;
    rolloutSteps?: number;
    batchSize?: number;
    minibatchSize?: number;
    epochs?: number;
  };
  episode?: { steps?: number; start?: string; end?: string };
  trainSeconds?: number; // wall-clock duration to train before auto-stop
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

// Broker execution jobs
export type PlaceOrderJobData = {
  action: 'place';
  symbol: string; // e.g., BTC/USDT
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price?: number;
  params?: Record<string, any>;
  // optional metadata to persist Trade
  agentId?: string;
  strategyId?: string;
  stopLoss?: number;
  takeProfit?: number;
};

export type CancelOrderJobData = {
  action: 'cancel';
  orderId: string;
  symbol: string;
  params?: Record<string, any>;
};

export type BrokerJobData = PlaceOrderJobData | CancelOrderJobData;

export const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 50,
  removeOnFail: 100,
};
