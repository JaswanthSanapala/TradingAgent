import { EventEmitter } from 'events';

// Global singleton event bus for server-side events
class SocketBus extends EventEmitter {}
export const socketBus = new SocketBus();

// Event types
export type TrainProgressEvent = {
  phase: 'init' | 'batch' | 'epoch' | 'done' | 'error';
  message?: string;
  epoch?: number;
  batch?: number;
  totalBatches?: number;
  loss?: number;
  symbol?: string;
  timeframe?: string;
  windowSize?: number;
  ts?: string;
};

export const TRAIN_PROGRESS_EVENT = 'train:progress';

// Prediction events
export type PredictionCreatedEvent = {
  id: string;
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  action: string;
  confidence: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  meta?: any;
};

export const PREDICTION_CREATED_EVENT = 'prediction:created';

export type PredictionUpdatedEvent = PredictionCreatedEvent & {
  meta?: any;
};
export const PREDICTION_UPDATED_EVENT = 'prediction:updated';

export type TradeCreatedEvent = {
  id: string;
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  entryTime: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  action: 'buy' | 'sell';
};
export const TRADE_CREATED_EVENT = 'trade:created';
