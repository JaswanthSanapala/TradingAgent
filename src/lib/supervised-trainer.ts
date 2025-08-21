import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/db';

export type SupervisedTrainOptions = {
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  lookback: number; // input window length
  lookahead: number; // steps ahead for label
  limit?: number; // number of samples
  epochs?: number;
  batchSize?: number;
};

export type SupervisedTrainResult = {
  artifactPath: string;
  metrics: { loss: number; acc: number };
  samples: number;
};

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// Build simple feature vector per timestep using Indicator + OHLCV
function buildFeatures(row: any) {
  const { open, high, low, close, volume } = row;
  const rsi = row.rsi ?? 50;
  const macd = row.macd ?? 0;
  const macdSignal = row.macdSignal ?? 0;
  const bbUpper = row.bbUpper ?? close;
  const bbLower = row.bbLower ?? close;
  const atr = row.atr ?? 0;
  const spreadBB = bbUpper - bbLower || 1e-6;
  return [
    close,
    volume,
    rsi,
    macd,
    macdSignal,
    (close - bbLower) / spreadBB,
    atr,
    (high - low) / (close || 1e-6),
  ];
}

export async function loadDatasetFromDB(symbol: string, timeframe: string, lookback: number, lookahead: number, limit = 5000) {
  // pull recent MarketData joined with Indicator
  const md = await prisma.marketData.findMany({
    where: { symbol, timeframe },
    orderBy: { timestamp: 'asc' },
    take: limit + lookback + lookahead + 1,
    include: { indicators: true },
  });
  if (md.length < lookback + lookahead + 10) {
    throw new Error('Not enough market data to build dataset');
  }

  const X: number[][][] = [];
  const y: number[] = []; // 0=hold,1=buy,2=sell

  for (let i = lookback; i < md.length - lookahead; i++) {
    const windowRows = md.slice(i - lookback, i);
    const futureClose = md[i + lookahead].close;
    const currClose = md[i].close;
    const ret = (futureClose - currClose) / currClose;
    const thr = 0.002; // 0.2% threshold
    const label = ret > thr ? 1 : ret < -thr ? 2 : 0;

    const feats = windowRows.map((r) => buildFeatures({ ...r, ...(r as any).indicators?.[0] }));
    X.push(feats);
    y.push(label);
  }

  // Normalize features per feature dimension across dataset
  const featDim = X[0][0].length;
  const flat = X.flat(1); // concat across time
  const means = Array(featDim).fill(0);
  const stds = Array(featDim).fill(0);
  for (let d = 0; d < featDim; d++) {
    const vals = flat.map((v) => v[d]);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const s = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1) || 1);
    means[d] = m; stds[d] = s || 1;
  }
  const Xnorm = X.map((seq) => seq.map((v) => v.map((val, d) => (val - means[d]) / stds[d])));

  return { X: Xnorm, y, featDim };
}

function buildModel(inputLen: number, featDim: number) {
  const model = tf.sequential();
  // TimeDistributed dense via 1D conv can be added; keep it simple
  model.add(tf.layers.flatten({ inputShape: [inputLen, featDim] }));
  model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3 })); // logits for 3 classes
  model.compile({ optimizer: tf.train.adam(1e-3), loss: tf.losses.softmaxCrossEntropy, metrics: ['accuracy'] as any });
  return model;
}

export async function trainSupervised(opts: SupervisedTrainOptions): Promise<SupervisedTrainResult> {
  const epochs = opts.epochs ?? 8;
  const batchSize = opts.batchSize ?? 64;
  const { X, y, featDim } = await loadDatasetFromDB(opts.symbol, opts.timeframe, opts.lookback, opts.lookahead, opts.limit ?? 5000);

  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));

  const model = buildModel(opts.lookback, featDim);
  const hist = await model.fit(xs, ys, { epochs, batchSize, verbose: 0, validationSplit: 0.1 });

  const loss = hist.history.loss?.slice(-1)[0] as number;
  const acc = (hist.history.acc || hist.history.accuracy)?.slice(-1)[0] as number;

  const saveDir = path.join('data', 'models', 'agents', opts.agentId, `v${Date.now()}`);
  ensureDirSync(saveDir);
  await model.save(`file://${saveDir}`);

  // Update agent modelPath
  await prisma.agent.update({ where: { id: opts.agentId }, data: { modelPath: saveDir } });

  await prisma.trainingRun.create({
    data: {
      agentId: opts.agentId,
      runType: 'supervised',
      params: { ...opts, symbol: opts.symbol, timeframe: opts.timeframe },
      metrics: { loss, acc },
      artifactPath: saveDir,
      status: 'completed',
    },
  });

  xs.dispose(); ys.dispose(); model.dispose();

  return { artifactPath: saveDir, metrics: { loss, acc }, samples: X.length };
}

export async function predictAction(modelPath: string, window: number[][]) {
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
  const input = tf.tensor3d([window]);
  const logits = model.predict(input) as tf.Tensor;
  const arr = (await logits.array()) as number[][];
  input.dispose(); logits.dispose();
  const probs = softmax(arr[0]);
  const idx = probs.indexOf(Math.max(...probs));
  const action = idx === 1 ? 'buy' : idx === 2 ? 'sell' : 'hold';
  return { action, confidence: Math.max(...probs), probs };
}
