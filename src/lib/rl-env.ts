import { prisma } from '@/lib/db';

export type Action = 0 | 1 | 2 | 3; // 0: hold, 1: buy/open long, 2: sell/open short, 3: close

export interface EnvConfig {
  symbol: string;
  timeframe: string;
  window: number; // number of timesteps in observation window
  feesBps?: number; // e.g., 4 bps = 0.0004
  slippageBps?: number; // applied on entry/exit
  rewardWeights?: {
    pnl: number; // realized pnl weight
    sharpeStep: number; // step-wise risk-adjusted reward proxy
    exposurePenalty: number; // penalty per step when in position
    flipPenalty: number; // penalty when flipping direction
  };
  episode?: { steps?: number; start?: string; end?: string };
}

export interface EnvStep {
  state: Float32Array;
  reward: number;
  done: boolean;
  info?: Record<string, any>;
}

export class TradingEnv {
  private cfg: Required<EnvConfig>;
  private idx = 0;
  private data: { ts: number; close: number; ret: number; vol: number; atr?: number; rsi?: number; cci?: number; macd?: number }[] = [];
  // position state
  private pos: 'flat' | 'long' | 'short' = 'flat';
  private entryPrice = 0;
  private realizedPnl = 0;
  private maxEquity = 0;
  private equity = 0;

  constructor(cfg: EnvConfig) {
    this.cfg = {
      feesBps: 0.0004,
      slippageBps: 0.00015,
      rewardWeights: { pnl: 1.0, sharpeStep: 0.1, exposurePenalty: 0.01, flipPenalty: 0.005 },
      episode: {},
      ...cfg,
    } as Required<EnvConfig>;
  }

  async load(): Promise<void> {
    // Load MarketData + Indicator from DB
    const start = this.cfg.episode.start ? new Date(this.cfg.episode.start) : undefined;
    const end = this.cfg.episode.end ? new Date(this.cfg.episode.end) : undefined;
    const md = await prisma.marketData.findMany({
      where: {
        symbol: this.cfg.symbol,
        timeframe: this.cfg.timeframe,
        ...(start || end ? { timestamp: { gte: start, lte: end } } : {}),
      },
      orderBy: { timestamp: 'asc' },
    });

    const inds = await prisma.indicator.findMany({
      where: { symbol: this.cfg.symbol, timeframe: this.cfg.timeframe, ...(start || end ? { timestamp: { gte: start, lte: end } } : {}) },
      orderBy: { timestamp: 'asc' },
    });
    const indByTs = new Map(inds.map(i => [i.timestamp.getTime(), i]));

    this.data = [];
    for (let i = 1; i < md.length; i++) {
      const prev = md[i - 1];
      const cur = md[i];
      const ret = (cur.close - prev.close) / prev.close;
      const vol = cur.volume;
      const ind = indByTs.get(cur.timestamp.getTime());
      this.data.push({
        ts: cur.timestamp.getTime(),
        close: cur.close,
        ret,
        vol,
        atr: ind?.atr ?? undefined,
        rsi: ind?.rsi ?? undefined,
        cci: ind?.cci ?? undefined,
        macd: ind?.macd ?? undefined,
      });
    }
  }

  reset(): Float32Array {
    if (this.data.length === 0) throw new Error('Env not loaded: call load() first');
    this.idx = Math.max(this.cfg.window, 1);
    if (this.cfg.episode.steps) {
      // keep within bounds
      this.idx = Math.min(this.idx, this.data.length - 1 - this.cfg.episode.steps);
    }
    this.pos = 'flat';
    this.entryPrice = 0;
    this.realizedPnl = 0;
    this.equity = 0;
    this.maxEquity = 0;
    return this.getState();
  }

  step(action: Action): EnvStep {
    // bounds
    if (this.idx >= this.data.length - 1) return { state: this.getState(), reward: 0, done: true };

    const cur = this.data[this.idx];
    const next = this.data[this.idx + 1];

    // slippage adjusted execution price approximation
    const slip = this.cfg.slippageBps;
    const fee = this.cfg.feesBps;

    let reward = 0;
    let flipped = false;

    // compute unrealized pnl before action for sharpe-esque signal
    const unreal = this.unrealizedPnl(cur.close);

    // handle action
    if (action === 1) { // buy
      if (this.pos === 'short') {
        this.realizedPnl += this.unrealizedPnl(cur.close) - Math.abs(cur.close) * (fee + slip);
        flipped = true;
        this.pos = 'long';
        this.entryPrice = cur.close * (1 + slip);
      } else if (this.pos === 'flat') {
        this.pos = 'long';
        this.entryPrice = cur.close * (1 + slip);
      }
    } else if (action === 2) { // sell/short
      if (this.pos === 'long') {
        this.realizedPnl += this.unrealizedPnl(cur.close) - Math.abs(cur.close) * (fee + slip);
        flipped = true;
        this.pos = 'short';
        this.entryPrice = cur.close * (1 - slip);
      } else if (this.pos === 'flat') {
        this.pos = 'short';
        this.entryPrice = cur.close * (1 - slip);
      }
    } else if (action === 3) { // close
      if (this.pos !== 'flat') {
        this.realizedPnl += this.unrealizedPnl(cur.close) - Math.abs(cur.close) * (fee + slip);
        this.pos = 'flat';
        this.entryPrice = 0;
      }
    }

    // advance time
    this.idx += 1;

    // step-based reward
    const w = this.cfg.rewardWeights;
    const stepSharpe = unreal / (Math.abs(cur.ret) + 1e-6); // proxy stability
    reward += w.sharpeStep * stepSharpe;
    reward += w.exposurePenalty * (this.pos !== 'flat' ? -1 : 0);
    reward += w.flipPenalty * (flipped ? -1 : 0);

    // realized pnl reward at transitions already in realizedPnl; add incremental equity change for shaping
    const newEquity = this.realizedPnl + this.unrealizedPnl(next.close);
    reward += w.pnl * (newEquity - this.equity);
    this.equity = newEquity;
    this.maxEquity = Math.max(this.maxEquity, this.equity);

    const doneBySteps = !!this.cfg.episode.steps && (this.idx >= (this.cfg.window + (this.cfg.episode.steps || 0)));
    const doneByData = this.idx >= this.data.length - 1;
    const done = doneBySteps || doneByData;

    return { state: this.getState(), reward, done, info: { idx: this.idx, pos: this.pos, equity: this.equity } };
  }

  getState(): Float32Array {
    const start = this.idx - this.cfg.window;
    const end = this.idx;
    const slice = this.data.slice(start, end);

    // features per time-step: [ret, vol, atr, rsi, cci, macd, pos_onehot(3)] => fixed length
    const posOneHot: [number, number, number] = [this.pos === 'flat' ? 1 : 0, this.pos === 'long' ? 1 : 0, this.pos === 'short' ? 1 : 0];
    const featSize = 6 + 3;
    const arr = new Float32Array(this.cfg.window * featSize);
    for (let i = 0; i < slice.length; i++) {
      const d = slice[i];
      const base = i * featSize;
      arr[base + 0] = d.ret ?? 0;
      arr[base + 1] = d.vol ?? 0;
      arr[base + 2] = d.atr ?? 0;
      arr[base + 3] = d.rsi ?? 50;
      arr[base + 4] = d.cci ?? 0;
      arr[base + 5] = d.macd ?? 0;
      arr[base + 6] = posOneHot[0];
      arr[base + 7] = posOneHot[1];
      arr[base + 8] = posOneHot[2];
    }
    return arr;
  }

  private unrealizedPnl(price: number): number {
    if (this.pos === 'flat') return 0;
    const diff = this.pos === 'long' ? (price - this.entryPrice) : (this.entryPrice - price);
    // assume unit size; scale left to trainer
    return diff / this.entryPrice;
  }
}
