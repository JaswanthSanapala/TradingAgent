import type * as tft from '@tensorflow/tfjs';
let tf: any; try { tf = require('@tensorflow/tfjs-node'); } catch { tf = require('@tensorflow/tfjs'); }
import { TradingEnv } from './rl-env';

export async function loadLatestCheckpoint(path: string): Promise<tft.LayersModel> {
  return await tf.loadLayersModel(`file://${path}/model.json`);
}

export async function inferAction(model: tft.LayersModel, state: Float32Array, window: number, mask?: boolean[]) {
  const x = tf.tensor(state, [window, 9]).expandDims(0);
  const [logitsT] = model.predict(x) as tft.Tensor[];
  const logits = await logitsT.array() as number[][];
  const l = logits[0].slice();
  if (mask && mask.length === l.length) {
    for (let i = 0; i < l.length; i++) if (!mask[i]) l[i] = -1e9;
  }
  const max = Math.max(...l);
  const exps = l.map(v => Math.exp(v - max));
  const sum = exps.reduce((a,b)=>a+b,0);
  const probs = exps.map(v => v/sum);
  const action = probs.indexOf(Math.max(...probs));
  return { action, confidence: probs[action], logits: l };
}
