import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// Build simple feature vector per timestep using Indicator + OHLCV
export function buildFeatures(row: any) {
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

export async function predictAction(modelPath: string, window: number[][]) {
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
  // Load scaler
  let means: number[] | undefined;
  let stds: number[] | undefined;
  try {
    const raw = fs.readFileSync(path.join(modelPath, 'scaler.json'), 'utf8');
    const parsed = JSON.parse(raw);
    means = parsed.means; stds = parsed.stds;
  } catch {}

  let normWindow = window;
  if (means && stds && means.length > 0 && stds.length === means.length) {
    normWindow = window.map((row) => row.map((val, d) => {
      const m = means![d] ?? 0; const s = (stds![d] ?? 1) || 1;
      const safe = Number.isFinite(val) ? val : m;
      const z = (safe - m) / s;
      return Math.max(-5, Math.min(5, z));
    }));
  }

  const input = tf.tensor3d([normWindow]);
  const logits = model.predict(input) as tf.Tensor;
  const arr = (await logits.array()) as number[][];
  input.dispose(); logits.dispose();
  const probs = softmax(arr[0]);
  const idx = probs.indexOf(Math.max(...probs));
  const action = idx === 1 ? 'buy' : idx === 2 ? 'sell' : 'hold';
  return { action, confidence: Math.max(...probs), probs };
}
