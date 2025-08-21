import * as tf from '@tensorflow/tfjs-node';
import { TradingEnv, EnvConfig, Action } from './rl-env';
import { socketBus, TRAIN_PROGRESS_EVENT } from '@/lib/socket-bus';
import { mkdirSync, existsSync } from 'fs';

export interface PPOHyperParams {
  gamma: number;
  gaeLambda: number;
  clipRatio: number;
  entropyCoef: number;
  valueCoef: number;
  lr: number;
  rolloutSteps: number;
  batchSize: number;
  minibatchSize: number;
  epochs: number;
}

export type TrainerState = 'idle' | 'running' | 'paused' | 'stopping';

export class PPOTrainer {
  private agentId: string;
  private env: TradingEnv;
  private h: PPOHyperParams;
  private model: tf.LayersModel;
  private optimizer: tf.Optimizer;
  private state: TrainerState = 'idle';
  private step = 0;
  private version = 1;
  private ckptDir: string;

  constructor(opts: { agentId: string; envCfg: EnvConfig; hparams: PPOHyperParams }) {
    this.agentId = opts.agentId;
    this.env = new TradingEnv(opts.envCfg);
    this.h = opts.hparams;
    this.model = this.buildModel(opts.envCfg.window);
    this.optimizer = tf.train.adam(this.h.lr);
    this.ckptDir = `data/models/agents/${this.agentId}/ppo/v${this.version}`;
    if (!existsSync(this.ckptDir)) mkdirSync(this.ckptDir, { recursive: true });
  }

  private buildModel(window: number): tf.LayersModel {
    const feat = 9; // must match env
    const input = tf.input({ shape: [window, feat] });
    const x1 = tf.layers.conv1d({ filters: 32, kernelSize: 3, activation: 'relu', padding: 'causal' }).apply(input) as tf.SymbolicTensor;
    const x2 = tf.layers.conv1d({ filters: 32, kernelSize: 5, activation: 'relu', padding: 'causal' }).apply(x1) as tf.SymbolicTensor;
    const x3 = tf.layers.gru({ units: 32, returnSequences: false }).apply(x2) as tf.SymbolicTensor;
    const trunk = tf.layers.dense({ units: 64, activation: 'relu' }).apply(x3) as tf.SymbolicTensor;
    const policy = tf.layers.dense({ units: 4, activation: 'linear', name: 'policy' }).apply(trunk) as tf.SymbolicTensor;
    const value = tf.layers.dense({ units: 1, activation: 'linear', name: 'value' }).apply(trunk) as tf.SymbolicTensor;
    return tf.model({ inputs: input, outputs: [policy, value] });
  }

  async start(params?: { trainingRunId?: string }) {
    await this.env.load();
    this.state = 'running';

    // rollout storage
    const obs: number[][][] = [];
    const actions: number[] = [];
    const logProbs: number[] = [];
    const rewards: number[] = [];
    const values: number[] = [];
    const dones: number[] = [];

    const window = (this.model.inputs[0].shape![1] as number);

    let sArr = this.env.reset();
    while (this.state !== 'stopping') {
      if (this.state === 'paused') { await new Promise(r => setTimeout(r, 100)); continue; }

      // collect rollout
      obs.length = 0; actions.length = 0; logProbs.length = 0; rewards.length = 0; values.length = 0; dones.length = 0;
      for (let t = 0; t < this.h.rolloutSteps; t++) {
        const s = tf.tensor(sArr, [window, 9]);
        const [logitsT, valueT] = this.model.predict(s.expandDims(0)) as tf.Tensor[];
        const logits = (await logitsT.array()) as number[][];
        const value = (await valueT.array()) as number[][];
        const { act, lp } = sampleActionAndLogProb(logits[0]);
        const step = this.env.step(act as Action);

        obs.push(Array.from(s.arraySync() as number[][]));
        actions.push(act);
        logProbs.push(lp);
        rewards.push(step.reward);
        values.push(value[0][0]);
        dones.push(step.done ? 1 : 0);

        sArr = step.state;
        this.step++;
        if (step.done) break;
      }

      // compute advantages with GAE
      const adv = gaeAdvantages(rewards, values, dones, this.h.gamma, this.h.gaeLambda);
      const ret = values.map((v, i) => v + adv[i]);

      // optimize policy with minibatches
      await this.update(obs, actions, logProbs, adv, ret);

      socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'batch', loss: 0, epoch: this.step, message: 'ppo update', ts: new Date().toISOString() });

      if (this.step % (this.h.rolloutSteps * 10) === 0) {
        await this.saveCheckpoint();
        socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'epoch', epoch: Math.floor(this.step / this.h.rolloutSteps), message: 'checkpoint saved', ts: new Date().toISOString() });
      }
    }

    this.state = 'idle';
    socketBus.emit(TRAIN_PROGRESS_EVENT, { phase: 'done', message: 'ppo stopped', ts: new Date().toISOString() });
  }

  pause() { this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  stop() { this.state = 'stopping'; }
  status() { return { state: this.state, step: this.step, ckptDir: this.ckptDir }; }

  private async update(obs: number[][][], actions: number[], logProbsOld: number[], adv: number[], ret: number[]) {
    // normalize advantages
    const mean = adv.reduce((a,b)=>a+b,0)/adv.length;
    const std = Math.sqrt(adv.reduce((a,b)=>a+(b-mean)*(b-mean),0)/adv.length + 1e-8);
    const advNorm = adv.map(a => (a-mean)/std);

    const N = obs.length;
    const idxs = [...Array(N).keys()];
    for (let epoch = 0; epoch < this.h.epochs; epoch++) {
      shuffle(idxs);
      for (let i = 0; i < N; i += this.h.minibatchSize) {
        const mbIdx = idxs.slice(i, Math.min(N, i + this.h.minibatchSize));
        const x = tf.tensor(mbIdx.map(j => obs[j]));
        const a = tf.tensor(mbIdx.map(j => actions[j]), [mbIdx.length], 'int32');
        const oldLp = tf.tensor(mbIdx.map(j => logProbsOld[j]));
        const advT = tf.tensor(mbIdx.map(j => advNorm[j]));
        const retT = tf.tensor(mbIdx.map(j => ret[j]));

        const loss = await this.optimizer.minimize(() => {
          const [logits, values] = this.model.apply(x, { training: true }) as tf.Tensor[];
          const logp = logProbFromLogits(logits, a);
          const ratio = tf.exp(logp.sub(oldLp));
          const clip1 = ratio.mul(advT);
          const clip2 = tf.clipByValue(ratio, 1 - this.h.clipRatio, 1 + this.h.clipRatio).mul(advT);
          const policyLoss = tf.neg(tf.minimum(clip1, clip2)).mean();

          const vLoss = tf.losses.meanSquaredError(retT, values.squeeze());
          const entropy = categoricalEntropy(logits).mean();
          const total = policyLoss.add(vLoss.mul(this.h.valueCoef)).sub(entropy.mul(this.h.entropyCoef));
          return total as tf.Scalar;
        }, true);

        loss?.dispose();
        x.dispose(); a.dispose(); oldLp.dispose(); advT.dispose(); retT.dispose();
      }
    }
  }

  private async saveCheckpoint() {
    await this.model.save(`file://${this.ckptDir}`);
  }
}

function sampleActionAndLogProb(logits: number[]): { act: number; lp: number } {
  const max = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - max));
  const sum = exps.reduce((a,b)=>a+b,0);
  const probs = exps.map(v => v/sum);
  let r = Math.random();
  let acc = 0;
  let idx = 0;
  for (let i=0;i<probs.length;i++){ acc += probs[i]; if (r<=acc){ idx=i; break; } }
  const lp = Math.log(probs[idx] + 1e-8);
  return { act: idx, lp };
}

function logProbFromLogits(logits: tf.Tensor, actions: tf.Tensor): tf.Tensor {
  const logProbs = tf.logSoftmax(logits as tf.Tensor2D);
  const oneHot = tf.oneHot(actions as tf.Tensor1D, (logits.shape[1] as number));
  return logProbs.mul(oneHot).sum(-1);
}

function categoricalEntropy(logits: tf.Tensor): tf.Tensor {
  const logProbs = tf.logSoftmax(logits as tf.Tensor2D);
  const probs = tf.softmax(logits as tf.Tensor2D);
  return tf.neg(probs.mul(logProbs).sum(-1));
}

function gaeAdvantages(rewards: number[], values: number[], dones: number[], gamma: number, lambda: number): number[] {
  const T = rewards.length;
  const adv = new Array(T).fill(0);
  let gae = 0;
  for (let t = T - 1; t >= 0; t--) {
    const nextV = t + 1 < T ? values[t + 1] : 0;
    const delta = rewards[t] + gamma * nextV * (1 - dones[t]) - values[t];
    gae = delta + gamma * lambda * (1 - dones[t]) * gae;
    adv[t] = gae;
  }
  return adv;
}

function shuffle<T>(arr: T[]): void { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }