import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/db';
import type { StrategySource, StrategyAction } from '@/lib/strategy-provider';
import { TsPluginStrategyProvider } from '@/lib/strategy-ts-plugin';
import { BacktestEngine } from '@/lib/backtest-engine';
import { buildFeatures } from '@/lib/ml-utils';

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
  labelingMode?: 'future_return' | 'imitation_strategy';
  strategySource?: StrategySource; // required if labelingMode = imitation_strategy
  ratios?: { train: number; val: number; test: number }; // optional for standard splits
};

export type SupervisedTrainResult = {
  artifactPath: string;
  metrics: { loss: number; acc: number; testAcc?: number };
  samples: number;
};

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Walk-forward training: multiple folds over time with proper train-only normalization each fold
export async function trainWalkForward(opts: SupervisedTrainOptions & {
  folds?: number;
  step?: number; // number of samples to advance each fold
  ratios?: { train: number; val: number; test: number };
  learningRate?: number;
}) {
  const { X, y, featDim } = await buildRawDataset(
    opts.symbol,
    opts.timeframe,
    opts.lookback,
    opts.lookahead,
    opts.limit ?? 5000,
    opts.labelingMode ?? 'future_return',
    opts.strategySource,
  );
  const N = X.length;
  const ratios = opts.ratios ?? { train: 0.7, val: 0.15, test: 0.15 };
  const foldSize = Math.floor(N * (ratios.train + ratios.val + ratios.test));
  const step = opts.step ?? Math.max(1, Math.floor(foldSize * 0.3));
  const folds = opts.folds ?? Math.max(1, Math.floor((N - foldSize) / step) + 1);

  const results: Array<{ fold: number; metrics: { loss: number; acc: number; testAcc?: number }; artifactPath: string }> = [];

  for (let f = 0; f < folds; f++) {
    const start = f * step;
    const end = Math.min(start + foldSize, N);
    const sliceX = X.slice(start, end);
    const sliceY = y.slice(start, end);

    const { trainEnd, valEnd } = computeSplitIdx(sliceX.length, ratios.train / (ratios.train + ratios.val + ratios.test), ratios.val / (ratios.train + ratios.val + ratios.test));
    const Xtrain = sliceX.slice(0, trainEnd);
    const ytrain = sliceY.slice(0, trainEnd);
    const Xval = sliceX.slice(trainEnd, valEnd);
    const yval = sliceY.slice(trainEnd, valEnd);
    const Xtest = sliceX.slice(valEnd);
    const ytest = sliceY.slice(valEnd);

    const { means, stds, normalizeBatch } = makeScalerFromTrain(Xtrain);
    const trainN = { X: normalizeBatch(Xtrain), y: ytrain };
    const valN = { X: normalizeBatch(Xval), y: yval };
    const testN = { X: normalizeBatch(Xtest), y: ytest };

    const lr = opts.learningRate ?? 1e-3;
    const agent = await prisma.agent.findUnique({ where: { id: opts.agentId }, select: { algorithm: true } });
    const arch = selectSupervisedArchitecture(agent?.algorithm);
    const model = arch === 'lstm' ? buildLstmModel(opts.lookback, featDim, lr) : arch === 'tcn' ? buildTcnModel(opts.lookback, featDim, lr) : buildMlpModel(opts.lookback, featDim, lr);

    const xs = tf.tensor3d(trainN.X);
    const ys = tf.tensor2d(trainN.y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));
    const xval = tf.tensor3d(valN.X);
    const yvalT = tf.tensor2d(valN.y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));
    const hist = await model.fit(xs, ys, { epochs: opts.epochs ?? 8, batchSize: opts.batchSize ?? 64, verbose: 0, validationData: [xval, yvalT] });
    const loss = hist.history.loss?.slice(-1)[0] as number;
    const acc = (hist.history.acc || hist.history.accuracy)?.slice(-1)[0] as number;

    let testAcc: number | undefined;
    if (testN.X.length > 0) {
      const xtest = tf.tensor3d(testN.X);
      const ytestT = tf.tensor2d(testN.y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));
      const evalRes = model.evaluate(xtest, ytestT, { verbose: 0 }) as tf.Scalar | tf.Tensor[];
      if (Array.isArray(evalRes)) {
        const accTensor = evalRes[1] as tf.Scalar;
        testAcc = (await accTensor.data())[0];
      }
      xtest.dispose(); ytestT.dispose();
    }

    const saveDir = path.join('data', 'models', 'agents', opts.agentId, `wf_v${Date.now()}_f${f}`);
    ensureDirSync(saveDir);
    await model.save(`file://${saveDir}`);
    try { fs.writeFileSync(path.join(saveDir, 'scaler.json'), JSON.stringify({ means, stds, lookback: opts.lookback, featDim }, null, 2)); } catch {}

    await prisma.trainingRun.create({
      data: {
        agentId: opts.agentId,
        runType: 'supervised',
        params: { ...opts, mode: 'walk_forward', fold: f },
        metrics: { loss, acc, testAcc },
        artifactPath: saveDir,
        status: 'completed',
      },
    });

    results.push({ fold: f, metrics: { loss, acc, testAcc }, artifactPath: saveDir });
    xs.dispose(); ys.dispose(); xval.dispose(); yvalT.dispose(); model.dispose();
  }

  // Aggregate
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const losses = results.map(r => r.metrics.loss).filter(Number.isFinite) as number[];
  const accs = results.map(r => r.metrics.acc).filter(Number.isFinite) as number[];
  const testAccs = results.map(r => r.metrics.testAcc ?? NaN).filter(Number.isFinite) as number[];
  return { results, summary: { loss: avg(losses), acc: avg(accs), testAcc: avg(testAccs) } };
}

// Simple grid search tuner
export async function tuneSupervised(opts: SupervisedTrainOptions & {
  grid?: { learningRates?: number[]; batchSizes?: number[]; epochs?: number[] };
  walkForward?: { folds?: number; step?: number };
}) {
  const grid = opts.grid || {};
  const lrs = grid.learningRates && grid.learningRates.length ? grid.learningRates : [1e-3];
  const bss = grid.batchSizes && grid.batchSizes.length ? grid.batchSizes : [64];
  const eps = grid.epochs && grid.epochs.length ? grid.epochs : [opts.epochs ?? 8];

  const sweepId = `sweep_${Date.now()}`;
  const trials: Array<{ params: any; metrics: any; artifactPath: string; trialIndex: number }> = [];
  let t = 0;
  for (const lr of lrs) {
    for (const bs of bss) {
      for (const ep of eps) {
        if (opts.walkForward) {
          const wf = await trainWalkForward({ ...opts, learningRate: lr, batchSize: bs, epochs: ep, folds: opts.walkForward.folds, step: opts.walkForward.step, ratios: opts.ratios });
          trials.push({ params: { lr, batchSize: bs, epochs: ep, mode: 'walk_forward' }, metrics: wf.summary, artifactPath: '', trialIndex: t });
          await prisma.trainingRun.create({
            data: {
              agentId: opts.agentId,
              runType: 'supervised',
              params: { ...opts, lr, batchSize: bs, epochs: ep, mode: 'tune_walk_forward', sweepId, trialIndex: t },
              metrics: wf.summary,
              status: 'completed',
            },
          });
        } else {
          const res = await trainSupervised({ ...opts, learningRate: lr, batchSize: bs, epochs: ep, ratios: opts.ratios });
          trials.push({ params: { lr, batchSize: bs, epochs: ep, mode: 'standard' }, metrics: res.metrics, artifactPath: res.artifactPath, trialIndex: t });
          await prisma.trainingRun.create({
            data: {
              agentId: opts.agentId,
              runType: 'supervised',
              params: { ...opts, lr, batchSize: bs, epochs: ep, mode: 'tune_standard', sweepId, trialIndex: t },
              metrics: res.metrics,
              artifactPath: res.artifactPath,
              status: 'completed',
            },
          });
        }
        t += 1;
      }
    }
  }
  // Choose best by highest testAcc then acc
  const pickScore = (m: any) => (Number.isFinite(m.testAcc) ? m.testAcc : -1) * 1e3 + (Number.isFinite(m.acc) ? m.acc : 0);
  trials.sort((a, b) => pickScore(b.metrics) - pickScore(a.metrics));
  const best = trials[0];
  // Record sweep summary as its own TrainingRun for traceability
  await prisma.trainingRun.create({
    data: {
      agentId: opts.agentId,
      runType: 'supervised',
      params: { ...opts, mode: opts.walkForward ? 'tune_walk_forward_summary' : 'tune_standard_summary', sweepId, trials: trials.map(({ params, metrics, artifactPath, trialIndex }) => ({ params, metrics, artifactPath, trialIndex })) },
      metrics: best?.metrics || {},
      artifactPath: best?.artifactPath || '',
      status: 'completed',
    },
  });
  return { best, trials };
}

// buildFeatures now imported from '@/lib/ml-utils'

// Helper: build raw sequences without normalization/splits
async function buildRawDataset(
  symbol: string,
  timeframe: string,
  lookback: number,
  lookahead: number,
  limit = 5000,
  labelingMode: 'future_return' | 'imitation_strategy' = 'future_return',
  strategySource?: StrategySource,
) {
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
  const ts: Date[] = [];

  // If imitation_strategy, compute actions using provider (ignores lookahead)
  let actions: StrategyAction[] | null = null;
  if (labelingMode === 'imitation_strategy') {
    if (!strategySource) throw new Error('strategySource is required for imitation_strategy labeling');
    const provider = new TsPluginStrategyProvider(strategySource);
    actions = await provider.computeActions({ marketData: md, symbol, timeframe });
    if (!Array.isArray(actions) || actions.length !== md.length) {
      // Try to allow actions aligned with bars from index 0; if shorter, pad holds
      const filled: StrategyAction[] = new Array(md.length).fill('hold');
      for (let i = 0; i < Math.min(actions?.length || 0, md.length); i++) filled[i] = actions![i];
      actions = filled;
    }
  }

  const endIdx = labelingMode === 'imitation_strategy' ? md.length : (md.length - lookahead);
  for (let i = lookback; i < endIdx; i++) {
    const windowRows = md.slice(i - lookback, i);
    let label: number;
    if (labelingMode === 'imitation_strategy') {
      const act = (actions as StrategyAction[])[i];
      label = act === 'buy' ? 1 : act === 'sell' ? 2 : 0;
    } else {
      const futureClose = md[i + lookahead].close;
      const currClose = md[i].close;
      const ret = (futureClose - currClose) / currClose;
      const thr = 0.002; // 0.2% threshold
      label = ret > thr ? 1 : ret < -thr ? 2 : 0;
    }

    // Build features with basic fallbacks
    const feats = windowRows.map((r) => buildFeatures({ ...r, ...(r as any).indicators?.[0] }));
    X.push(feats);
    y.push(label);
    ts.push(md[i].timestamp as unknown as Date);
  }

  const featDim = X[0][0].length;
  return { X, y, featDim, ts };
}

// Helper: compute train-only scaler and normalizer
function makeScalerFromTrain(Xtrain: number[][][]) {
  const featDim = Xtrain[0][0].length;
  const flatTrain = Xtrain.flat(1);
  const means = Array(featDim).fill(0);
  const stds = Array(featDim).fill(0);
  for (let d = 0; d < featDim; d++) {
    const vals = flatTrain.map((v) => v[d]).filter(Number.isFinite) as number[];
    const m = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    const varSum = vals.reduce((a, b) => a + (b - m) ** 2, 0);
    const s = Math.sqrt(varSum / Math.max(1, vals.length - 1));
    means[d] = Number.isFinite(m) ? m : 0;
    stds[d] = s > 0 ? s : 1;
  }
  const normalizeBatch = (seqs: number[][][]) => seqs.map((seq) =>
    seq.map((row) => row.map((val, d) => {
      const safe = Number.isFinite(val) ? val : means[d];
      const z = (safe - means[d]) / stds[d];
      return Math.max(-5, Math.min(5, z));
    }))
  );
  return { means, stds, normalizeBatch };
}

// Helper: split indices by ratios on chronological order
function computeSplitIdx(N: number, trainRatio = 0.8, valRatio = 0.1) {
  const trainEnd = Math.floor(N * trainRatio);
  const valEnd = Math.floor(N * (trainRatio + valRatio));
  return { trainEnd, valEnd };
}

export async function loadDatasetFromDB(symbol: string, timeframe: string, lookback: number, lookahead: number, limit = 5000, labelingMode: 'future_return' | 'imitation_strategy' = 'future_return', strategySource?: StrategySource, ratios?: { train: number; val: number; test: number }) {
  const { X, y, featDim, ts } = await buildRawDataset(symbol, timeframe, lookback, lookahead, limit, labelingMode, strategySource);

  // Chronological split: train 80%, val 10%, test 10%
  const N = X.length;
  const r = ratios && typeof ratios.train === 'number' ? ratios : { train: 0.8, val: 0.1, test: 0.1 };
  const { trainEnd, valEnd } = computeSplitIdx(N, r.train, r.val);

  const Xtrain = X.slice(0, trainEnd);
  const ytrain = y.slice(0, trainEnd);
  const Xval = X.slice(trainEnd, valEnd);
  const yval = y.slice(trainEnd, valEnd);
  const Xtest = X.slice(valEnd);
  const ytest = y.slice(valEnd);

  // Compute scaler on TRAIN only
  const { means, stds, normalizeBatch } = makeScalerFromTrain(Xtrain);

  return {
    train: { X: normalizeBatch(Xtrain), y: ytrain },
    val: { X: normalizeBatch(Xval), y: yval },
    test: { X: normalizeBatch(Xtest), y: ytest },
    featDim,
    scaler: { means, stds },
    timestamps: {
      train: ts.slice(0, trainEnd),
      val: ts.slice(trainEnd, valEnd),
      test: ts.slice(valEnd),
    },
  };
}

type SupervisedArchitecture = 'mlp' | 'lstm' | 'tcn';

function buildMlpModel(inputLen: number, featDim: number, learningRate = 1e-3) {
  const model = tf.sequential();
  model.add(tf.layers.flatten({ inputShape: [inputLen, featDim] }));
  model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3 }));
  model.compile({ optimizer: tf.train.adam(learningRate), loss: tf.losses.softmaxCrossEntropy, metrics: ['accuracy'] as any });
  return model;
}

function buildLstmModel(inputLen: number, featDim: number, learningRate = 1e-3) {
  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 64, inputShape: [inputLen, featDim], returnSequences: false }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3 }));
  model.compile({ optimizer: tf.train.adam(learningRate), loss: tf.losses.softmaxCrossEntropy, metrics: ['accuracy'] as any });
  return model;
}

function buildTcnModel(inputLen: number, featDim: number, learningRate = 1e-3) {
  // Simple temporal conv net approximation with dilated 1D convs
  const inputShape: [number, number] = [inputLen, featDim];
  const model = tf.sequential();
  model.add(tf.layers.conv1d({ inputShape, filters: 32, kernelSize: 3, dilationRate: 1, activation: 'relu', padding: 'causal' }));
  model.add(tf.layers.conv1d({ filters: 32, kernelSize: 3, dilationRate: 2, activation: 'relu', padding: 'causal' }));
  model.add(tf.layers.globalAveragePooling1d());
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3 }));
  model.compile({ optimizer: tf.train.adam(learningRate), loss: tf.losses.softmaxCrossEntropy, metrics: ['accuracy'] as any });
  return model;
}

function selectSupervisedArchitecture(agentAlgorithm: string | null | undefined): SupervisedArchitecture {
  // Default to TCN platform-wide
  if (!agentAlgorithm) return 'tcn';
  const algo = agentAlgorithm.toLowerCase();
  // Accept aliases: supervised_mlp/mlp, supervised_lstm/lstm, supervised_tcn/tcn
  if (algo.includes('lstm')) return 'lstm';
  if (algo.includes('mlp')) return 'mlp';
  if (algo.includes('tcn') || algo.includes('conv')) return 'tcn';
  // RL/unknown algos (ppo/a2c/dqn/sac/etc.) -> TCN for supervised flow
  return 'tcn';
}

export async function trainSupervised(opts: SupervisedTrainOptions & { learningRate?: number }): Promise<SupervisedTrainResult> {
  const epochs = opts.epochs ?? 8;
  const batchSize = opts.batchSize ?? 64;
  const { train, val, test, featDim, scaler, timestamps } = await loadDatasetFromDB(
    opts.symbol,
    opts.timeframe,
    opts.lookback,
    opts.lookahead,
    opts.limit ?? 5000,
    opts.labelingMode ?? 'future_return',
    opts.strategySource,
    opts.ratios,
  );
  // Fetch agent to choose architecture by Agent.algorithm
  const agent = await prisma.agent.findUnique({ where: { id: opts.agentId }, select: { algorithm: true } });
  const arch = selectSupervisedArchitecture(agent?.algorithm);

  const xs = tf.tensor3d(train.X);
  const ys = tf.tensor2d(train.y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));
  const xval = tf.tensor3d(val.X);
  const yval = tf.tensor2d(val.y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));

  const lr = opts.learningRate ?? 1e-3;
  const model = arch === 'lstm'
    ? buildLstmModel(opts.lookback, featDim, lr)
    : arch === 'tcn'
    ? buildTcnModel(opts.lookback, featDim, lr)
    : buildMlpModel(opts.lookback, featDim, lr);
  const hist = await model.fit(xs, ys, { epochs, batchSize, verbose: 0, validationData: [xval, yval] });

  const loss = hist.history.loss?.slice(-1)[0] as number;
  const acc = (hist.history.acc || hist.history.accuracy)?.slice(-1)[0] as number;

  // Evaluate on test set if available
  let testAcc: number | undefined;
  if (test.X.length > 0) {
    const xtest = tf.tensor3d(test.X);
    const ytest = tf.tensor2d(test.y.map((c) => (c === 0 ? [1, 0, 0] : c === 1 ? [0, 1, 0] : [0, 0, 1])));
    const evalRes = model.evaluate(xtest, ytest, { verbose: 0 }) as tf.Scalar | tf.Tensor[];
    if (Array.isArray(evalRes)) {
      const accTensor = evalRes[1] as tf.Scalar;
      testAcc = (await accTensor.data())[0];
    }
    xtest.dispose(); ytest.dispose();
  }

  const saveDir = path.join('data', 'models', 'agents', opts.agentId, `v${Date.now()}`);
  ensureDirSync(saveDir);
  await model.save(`file://${saveDir}`);
  // Persist scaler for inference consistency
  try {
    fs.writeFileSync(path.join(saveDir, 'scaler.json'), JSON.stringify({ ...scaler, lookback: opts.lookback, featDim }, null, 2));
  } catch {}

  // Update agent modelPath
  await prisma.agent.update({ where: { id: opts.agentId }, data: { modelPath: saveDir } });

  const trainingRun = await prisma.trainingRun.create({
    data: {
      agentId: opts.agentId,
      runType: 'supervised',
      params: { ...opts, symbol: opts.symbol, timeframe: opts.timeframe, architecture: arch },
      metrics: { loss, acc, testAcc },
      artifactPath: saveDir,
      status: 'completed',
    },
  });

  // Post-train OOS backtest on test window (if available)
  if ((timestamps?.test?.length || 0) > 0) {
    const startDate = new Date(timestamps!.test![0]);
    const endDate = new Date(timestamps!.test![timestamps!.test!.length - 1]);
    try {
      const engine = new BacktestEngine({
        startDate,
        endDate,
        symbol: opts.symbol,
        timeframe: opts.timeframe,
        initialBalance: 10000,
        maxRiskPerTrade: 0.01,
        maxTradesPerDay: 10,
        minRewardRiskRatio: 1.5,
      });
      const bt = await engine.runBacktest(opts.agentId, opts.strategyId);
      // Keep a concise summary in metrics
      const backtestSummary = {
        totalTrades: bt.totalTrades,
        winRate: bt.winRate,
        totalPnl: bt.totalPnl,
        totalPnlPercent: bt.totalPnlPercent,
        maxDrawdown: bt.maxDrawdown,
        sharpeRatio: bt.sharpeRatio,
        profitFactor: bt.profitFactor,
      };
      await prisma.trainingRun.update({
        where: { id: trainingRun.id },
        data: { metrics: { loss, acc, testAcc, backtest: backtestSummary } },
      });
    } catch (e) {
      // If backtest fails, keep training metrics only
    }
  }

  xs.dispose(); ys.dispose(); xval.dispose(); yval.dispose(); model.dispose();

  const totalSamples = train.X.length + val.X.length + test.X.length;
  return { artifactPath: saveDir, metrics: { loss, acc, testAcc }, samples: totalSamples };
}
