import { Ohlcv } from '@/lib/market/mtf';

export type SmcOptions = {
  // Optional per-step indicator rows aligned to sliceBase timestamps
  // Only fields actually present will be used (e.g., atr, cci)
  baseIndicators?: Array<Record<string, number | null | undefined>>;
  // Parameters (may be inferred from strategy text elsewhere)
  zoneFreshCandles?: number; // default 20
  obHorizon?: number; // default 5
  liquidityWindow?: number; // default 15
  cciThreshold?: number; // default 100
  atrRangeMultiplier?: number; // default 0.5 (for zone width checks)
};

// Return a flattened array of length = sliceLen * features.length
export function computeSmcFlagsForSlice(sliceBase: Ohlcv[], features: string[], opts: SmcOptions = {}): number[] {
  const want = new Set(features.map((s) => s.toLowerCase()));
  const flags: number[] = [];
  const closes = sliceBase.map(r => r.close);
  const highs = sliceBase.map(r => r.high);
  const lows = sliceBase.map(r => r.low);
  const N = sliceBase.length;

  const swings = computeSwings(highs, lows);
  const bosArr = want.has('bos') ? detectBoS(closes, swings) : zeros(N);
  const chochArr = want.has('choch') ? detectCHoCH(closes, swings, opts) : zeros(N);
  const obArr = want.has('ob') ? detectOB(sliceBase, opts) : zeros(N);
  const fvgArr = want.has('fvg') ? detectFVG(sliceBase) : zeros(N);
  const liqArr = want.has('liquidity') ? detectLiquidity(closes, opts) : zeros(N);

  for (let i = 0; i < N; i++) {
    for (const f of features) {
      const k = f.toLowerCase();
      if (k === 'bos') flags.push(bosArr[i]);
      else if (k === 'choch') flags.push(chochArr[i]);
      else if (k === 'ob') flags.push(obArr[i]);
      else if (k === 'fvg') flags.push(fvgArr[i]);
      else if (k === 'liquidity') flags.push(liqArr[i]);
      else flags.push(0);
    }
  }
  return flags;
}

function zeros(n: number) { return Array(n).fill(0); }

function computeSwings(highs: number[], lows: number[]) {
  const swingH: boolean[] = Array(highs.length).fill(false);
  const swingL: boolean[] = Array(lows.length).fill(false);
  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2]) swingH[i] = true;
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) swingL[i] = true;
  }
  return { swingH, swingL };
}

function detectBoS(closes: number[], swings: { swingH: boolean[]; swingL: boolean[] }) {
  const out = zeros(closes.length);
  let lastHighIdx = -1; let lastLowIdx = -1;
  for (let i = 0; i < closes.length; i++) {
    if (swings.swingH[i]) lastHighIdx = i;
    if (swings.swingL[i]) lastLowIdx = i;
    if (lastHighIdx >= 0 && i > lastHighIdx && closes[i] > closes[lastHighIdx]) out[i] = 1; // break above swing high
    if (lastLowIdx >= 0 && i > lastLowIdx && closes[i] < closes[lastLowIdx]) out[i] = -1; // break below swing low
  }
  return out;
}

function detectCHoCH(closes: number[], swings: { swingH: boolean[]; swingL: boolean[] }, opts: SmcOptions) {
  const out = zeros(closes.length);
  let trend = 0; // 1 up, -1 down
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) trend = trend >= 0 ? 1 : trend - 1;
    else if (closes[i] < closes[i-1]) trend = trend <= 0 ? -1 : trend + 1;
    // CHoCH heuristic: a BoS opposite to prior direction with optional CCI confirmation
    const cciThr = opts.cciThreshold ?? 100;
    const cci = opts.baseIndicators && typeof opts.baseIndicators[i]?.cci === 'number' ? Number(opts.baseIndicators[i]!.cci) : undefined;
    if (swings.swingH[i] && trend < 0) {
      if (cci === undefined || cci >= cciThr) out[i] = 1;
    }
    if (swings.swingL[i] && trend > 0) {
      if (cci === undefined || cci <= -cciThr) out[i] = -1;
    }
  }
  return out;
}

function detectOB(slice: Ohlcv[], opts: SmcOptions) {
  const out = zeros(slice.length);
  const H = opts.obHorizon ?? 5;
  // Mark last opposing candle before strong move over next 3 bars
  for (let i = 0; i < slice.length - Math.max(3, H); i++) {
    const bearToBull = slice[i].close < slice[i].open && slice[i+1].close > slice[i+1].open && slice[i+2].close > slice[i+2].open;
    const bullToBear = slice[i].close > slice[i].open && slice[i+1].close < slice[i+1].open && slice[i+2].close < slice[i+2].open;
    if (bearToBull) out[i] = 1;
    if (bullToBear) out[i] = -1;
  }
  return out;
}

function detectFVG(slice: Ohlcv[]) {
  const out = zeros(slice.length);
  for (let t = 2; t < slice.length; t++) {
    const gapUp = slice[t].low > slice[t-2].high;
    const gapDown = slice[t].high < slice[t-2].low;
    if (gapUp) out[t] = 1; if (gapDown) out[t] = -1;
  }
  return out;
}

function detectLiquidity(closes: number[], opts: SmcOptions) {
  const out = zeros(closes.length);
  const W = opts.liquidityWindow ?? 15;
  for (let i = 2; i < closes.length; i++) {
    const eqHighs = Math.abs(closes[i] - closes[i-1]) / Math.max(1e-6, closes[i]) < 0.001;
    const eqLows = Math.abs(closes[i] - closes[i-1]) / Math.max(1e-6, closes[i]) < 0.001;
    if (eqHighs || eqLows) out[i] = 1;
  }
  return out;
}
