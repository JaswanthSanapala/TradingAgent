import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import * as tf from '@tensorflow/tfjs-node';
import { logger } from '@/lib/logger';
import { socketBus, TRAIN_PROGRESS_EVENT } from '@/lib/socket-bus';

export interface TrainParams {
  symbol: string;
  timeframe: string;
  windowSize: number;
  maskRatio?: number; // override JSONL-provided mask
  epochs?: number;
  limit?: number; // max windows to load
  windowsDir?: string; // if provided, use this directory directly
}

interface WindowRecord {
  symbol: string;
  timeframe: string;
  maskIdx: number[];
  rows: Array<{ c: number; i?: any }>; // using close + indicators minimal
}

export async function trainUnsupervised(params: TrainParams): Promise<{ savedModelPath: string; steps: number; loss: number }>{
  const { symbol, timeframe, windowSize } = params;
  const epochs = params.epochs ?? 2;
  const limit = params.limit ?? 2000;
  const maskRatio = params.maskRatio ?? 0.15;

  socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'init', message: 'Loading windows', symbol, timeframe, windowSize, ts: new Date().toISOString() });

  const dir = params.windowsDir || path.join(process.cwd(), 'data', 'windows', `symbol=${sanitize(symbol)}`, `timeframe=${timeframe}`, `w=${windowSize}_s=`);
  const candidateDirs = await listCandidateDirs(dir);
  if (candidateDirs.length === 0) throw new Error(`No window directory found under ${dir}`);

  const windows: number[][] = [];
  const masks: number[][] = [];

  for (const d of candidateDirs) {
    const files = (await fsp.readdir(d)).filter(f => f.endsWith('.jsonl'));
    for (const f of files) {
      await loadJsonl(path.join(d, f), limit - windows.length, (rec) => {
        if (rec.rows?.length !== windowSize) return;
        const x = rec.rows.map((r: any) => Number(r.c));
        if (x.some((v: any) => !Number.isFinite(v))) return;
        const maskIdx = (params.maskRatio !== undefined ? sampleMaskIndexes(windowSize, Math.floor(windowSize * maskRatio)) : rec.maskIdx || []);
        windows.push(x);
        masks.push(maskToVector(windowSize, maskIdx));
      });
      if (windows.length >= limit) break;
    }
    if (windows.length >= limit) break;
  }

  if (windows.length === 0) throw new Error('No windows loaded');
  logger.info(`Loaded ${windows.length} windows for training`);
  socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'init', message: `Loaded ${windows.length} windows`, symbol, timeframe, windowSize, ts: new Date().toISOString() });

  // Normalize per-window (z-score)
  const X = windows.map(w => {
    const mu = mean(w); const sd = std(w, mu) || 1e-6;
    return w.map(v => (v - mu) / sd);
  });
  const M = masks; // 0/1 mask vector

  const xTensor = tf.tensor2d(X); // [N, T]
  const mTensor = tf.tensor2d(M); // [N, T]

  const model = buildMaskedAutoencoder(windowSize);
  model.compile({ optimizer: tf.train.adam(1e-3), loss: maskedMSELoss(mTensor) });

  const batchesPerEpoch = Math.ceil(windows.length / 64);

  const history = await model.fit(xTensor, xTensor, {
    epochs,
    batchSize: 64,
    verbose: 0,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'epoch', epoch: epoch + 1, totalBatches: batchesPerEpoch, loss: Number(logs?.loss ?? NaN), symbol, timeframe, windowSize, ts: new Date().toISOString() });
      },
      onTrainEnd: async (logs) => {
        socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'done', message: 'Training complete', loss: Number((logs as any)?.loss ?? NaN), symbol, timeframe, windowSize, ts: new Date().toISOString() });
      },
      onTrainBegin: async () => {
        socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'init', message: 'Training started', symbol, timeframe, windowSize, ts: new Date().toISOString() });
      },
    },
  });

  const finalLoss = Array.isArray(history.history.loss) ? Number(history.history.loss.at(-1)) : Number(history.history.loss);

  // Save model
  const outDir = path.join(process.cwd(), 'data', 'models');
  await fsp.mkdir(outDir, { recursive: true });
  const baseName = `${sanitize(symbol)}_${timeframe}_w${windowSize}_ae`;
  const savedModelPath = `file://${path.join(outDir, baseName)}`;
  await model.save(savedModelPath);
  socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'done', message: `Model saved at ${savedModelPath}`, symbol, timeframe, windowSize, ts: new Date().toISOString() });

  // Optionally, compute embeddings for dataset (encoder output)
  const encoder = (model as any).encoder as tf.LayersModel;
  const emb = encoder.predict(xTensor) as tf.Tensor;
  // Encoder outputs shape [N, D], so `array()` resolves to number[][]
  const embArr = (await emb.array()) as number[][];
  const embPath = path.join(outDir, `${baseName}_embeddings.json`);
  const maxRows = Math.min(200, emb.shape?.[0] ?? embArr.length);
  await fsp.writeFile(embPath, JSON.stringify({ shape: emb.shape, embeddings: embArr.slice(0, maxRows) }));

  xTensor.dispose();
  mTensor.dispose();
  emb.dispose();
  model.dispose();

  return { savedModelPath, steps: windows.length, loss: finalLoss };
}

function buildMaskedAutoencoder(T: number) {
  const input = tf.input({ shape: [T] });
  const x = tf.layers.reshape({ targetShape: [T, 1] }).apply(input) as tf.SymbolicTensor;
  const h1 = tf.layers.conv1d({ filters: 16, kernelSize: 5, activation: 'relu', padding: 'same' }).apply(x) as tf.SymbolicTensor;
  const h2 = tf.layers.conv1d({ filters: 32, kernelSize: 5, activation: 'relu', padding: 'same' }).apply(h1) as tf.SymbolicTensor;
  const g1 = tf.layers.globalAveragePooling1d().apply(h2) as tf.SymbolicTensor;
  const z = tf.layers.dense({ units: 32, activation: 'relu' }).apply(g1) as tf.SymbolicTensor;
  const z2 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(z) as tf.SymbolicTensor;
  const up = tf.layers.repeatVector({ n: T }).apply(z2) as tf.SymbolicTensor;
  const dec1 = tf.layers.lstm({ units: 32, returnSequences: true }).apply(up) as tf.SymbolicTensor;
  const dec2 = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: 1 }) }).apply(dec1) as tf.SymbolicTensor;
  const out = tf.layers.reshape({ targetShape: [T] }).apply(dec2) as tf.SymbolicTensor;

  const model = tf.model({ inputs: input, outputs: out });
  // Expose encoder for embeddings
  const encoder = tf.model({ inputs: input, outputs: z });
  (model as any).encoder = encoder;
  return model;
}

function maskedMSELoss(maskTensor: tf.Tensor2D) {
  return (yTrue: tf.Tensor, yPred: tf.Tensor) => tf.tidy(() => {
    const mask = maskTensor; // [N, T]
    const diff = tf.mul(tf.sub(yTrue, yPred), mask);
    const mse = tf.mean(tf.square(diff));
    return mse;
  });
}

async function listCandidateDirs(base: string): Promise<string[]> {
  // base may already be a target dir or a parent with multiple stride variants
  const exists = await existsDir(base);
  if (exists) {
    const stat = await fsp.stat(base);
    if (stat.isDirectory()) {
      // If the path contains "_s=", it's a leaf; otherwise collect children
      if (base.includes('_s=')) return [base];
      const children = await fsp.readdir(base, { withFileTypes: true });
      return children.filter(d => d.isDirectory()).map(d => path.join(base, d.name));
    }
  }
  return [];
}

async function existsDir(p: string): Promise<boolean> {
  try { const s = await fsp.stat(p); return s.isDirectory(); } catch { return false; }
}

async function loadJsonl(file: string, max: number, onRec: (r: WindowRecord) => void) {
  if (max <= 0) return;
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  let buf = '';
  for await (const chunk of stream as any) {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      try { onRec(JSON.parse(line)); } catch {}
      if (--max <= 0) { stream.close(); return; }
    }
  }
}

function maskToVector(T: number, idx: number[]) {
  const v = new Array(T).fill(0);
  for (const i of idx) if (i >= 0 && i < T) v[i] = 1;
  return v;
}

function sampleMaskIndexes(N: number, k: number): number[] {
  const idx = new Set<number>();
  while (idx.size < k) idx.add(Math.floor(Math.random() * N));
  return Array.from(idx.values());
}

function mean(a: number[]) { return a.reduce((s, v) => s + v, 0) / a.length; }
function std(a: number[], mu: number) { return Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length); }
function sanitize(sym: string) { return sym.replace(/\//g, '_'); }
