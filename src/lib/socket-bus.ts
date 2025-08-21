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
