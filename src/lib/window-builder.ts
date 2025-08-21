import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

export interface WindowBuilderParams {
  symbol: string;
  timeframe: string;
  start: Date;
  end: Date;
  windowSize: number; // e.g., 256
  stride?: number; // e.g., 16
  outDir?: string; // default data/windows
  maskRatio?: number; // 0..1 for masked reconstruction
}

export async function buildUnsupervisedWindows(params: WindowBuilderParams): Promise<{ windows: number; filePath: string }>{
  const { symbol, timeframe, start, end, windowSize } = params;
  const stride = params.stride ?? 16;
  const maskRatio = Math.max(0, Math.min(1, params.maskRatio ?? 0));
  const outDir = params.outDir || path.join(process.cwd(), 'data', 'windows', `symbol=${sanitize(symbol)}`, `timeframe=${timeframe}`, `w=${windowSize}_s=${stride}`);

  const md = await prisma.marketData.findMany({
    where: { symbol, timeframe, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: 'asc' },
  });
  if (md.length < windowSize) {
    const filePath = path.join(outDir, `empty_${Date.now()}.jsonl`);
    await ensureDir(outDir);
    await fs.writeFile(filePath, '');
    return { windows: 0, filePath };
  }

  // Load matching indicators
  const timestamps = md.map(r => r.timestamp);
  const inds = await prisma.indicator.findMany({
    where: { symbol, timeframe, timestamp: { in: timestamps } },
  });
  const indMap = new Map<number, typeof inds[number]>();
  for (const i of inds) indMap.set(i.timestamp.getTime(), i);

  const filePath = path.join(outDir, `windows_${Date.now()}.jsonl`);
  await ensureDir(outDir);
  const fh = await fs.open(filePath, 'w');
  let count = 0;

  try {
    for (let startIdx = 0; startIdx + windowSize <= md.length; startIdx += stride) {
      const slice = md.slice(startIdx, startIdx + windowSize);
      const rows = slice.map(r => ({
        t: r.timestamp.getTime(),
        o: r.open,
        h: r.high,
        l: r.low,
        c: r.close,
        v: r.volume,
        i: packInd(indMap.get(r.timestamp.getTime())),
      }));

      // Compute simple regime tags
      const regime = computeRegime(rows);

      // Apply masking indexes if requested (mask close price indices)
      const maskIdx: number[] = maskRatio > 0 ? sampleMaskIndexes(windowSize, Math.floor(windowSize * maskRatio)) : [];

      const record = { symbol, timeframe, regime, maskIdx, rows };
      await fh.writeFile(JSON.stringify(record) + '\n');
      count++;
    }
  } finally {
    await fh.close();
  }

  logger.info(`Window file written: ${filePath} (${count} windows)`);
  return { windows: count, filePath };
}

function packInd(ind?: any) {
  if (!ind) return null;
  return {
    atr: ind.atr ?? null,
    cci: ind.cci ?? null,
    rsi: ind.rsi ?? null,
    macd: ind.macd ?? null,
    macdSignal: ind.macdSignal ?? null,
    macdHistogram: ind.macdHistogram ?? null,
    bbU: ind.bbUpper ?? null,
    bbM: ind.bbMiddle ?? null,
    bbL: ind.bbLower ?? null,
    sh: ind.swingHigh ?? null,
    sl: ind.swingLow ?? null,
    be: ind.bullishEngulfing ?? null,
    se: ind.bearishEngulfing ?? null,
    dj: ind.doji ?? null,
    s20: ind.sma20 ?? null,
    s50: ind.sma50 ?? null,
  };
}

function computeRegime(rows: Array<{ c: number; v: number }>) {
  // Simple trend: SMA50 vs SMA20 proxy over the window
  const closes = rows.map(r => r.c);
  const sma = (arr: number[], n: number) => {
    if (arr.length < n) return null;
    let sum = 0;
    for (let i = arr.length - n; i < arr.length; i++) sum += arr[i];
    return sum / n;
  };
  const s20 = sma(closes, Math.min(20, closes.length));
  const s50 = sma(closes, Math.min(50, closes.length));
  const trend = s20 !== null && s50 !== null ? (s20 > s50 ? 'up' : s20 < s50 ? 'down' : 'flat') : 'unknown';

  // Volatility regime via std of returns
  let vol = 0;
  if (closes.length >= 2) {
    const rets = [] as number[];
    for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varr = rets.reduce((a, b) => a + (b - mu) * (b - mu), 0) / rets.length;
    vol = Math.sqrt(varr);
  }
  const volRegime = vol > 0.01 ? 'high' : vol > 0.005 ? 'medium' : 'low';

  return { trend, vol: volRegime };
}

function sampleMaskIndexes(N: number, k: number): number[] {
  const idx = new Set<number>();
  while (idx.size < k) {
    idx.add(Math.floor(Math.random() * N));
  }
  return Array.from(idx.values()).sort((a, b) => a - b);
}

function sanitize(sym: string) {
  return sym.replace(/\//g, '_');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}
