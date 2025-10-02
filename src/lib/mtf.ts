import { prisma } from '@/lib/db';
import { computeSmcFlagsForSlice } from '@/lib/smc';

export type Ohlcv = { timestamp: Date; open: number; high: number; low: number; close: number; volume: number };

const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
};

export function timeframeToMs(tf: string): number {
  const k = tf.toLowerCase();
  if (TIMEFRAME_MS[k] != null) return TIMEFRAME_MS[k];
  // naive parser like '4H', '15M'
  const m = k.match(/^(\d+)([mhdw])$/);
  if (!m) throw new Error(`Unsupported timeframe: ${tf}`);
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
  return n * mult;
}

export function pickBaseTimeframe(timeframes: string[]): string {
  if (!timeframes.length) throw new Error('No timeframes provided');
  const sorted = [...timeframes].sort((a, b) => timeframeToMs(a) - timeframeToMs(b));
  return sorted[0];
}

export async function loadSeries(symbol: string, timeframe: string, limitAsc: number): Promise<Ohlcv[]> {
  const rows = await prisma.marketData.findMany({
    where: { symbol, timeframe },
    orderBy: { timestamp: 'asc' },
    take: limitAsc,
  });
  return rows.map(r => ({ timestamp: r.timestamp, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
}

// Align multiple timeframe series to the base timeframe via forward-fill (last known value <= base ts)
export function alignMtf(base: Ohlcv[], others: Record<string, Ohlcv[]>): Array<{ t: number; rows: Record<string, Ohlcv | null> }>{
  const cursors: Record<string, number> = {};
  for (const tf of Object.keys(others)) cursors[tf] = 0;
  const result: Array<{ t: number; rows: Record<string, Ohlcv | null> }> = [];
  for (const b of base) {
    const ts = b.timestamp.getTime();
    const rows: Record<string, Ohlcv | null> = {};
    for (const [tf, arr] of Object.entries(others)) {
      let i = cursors[tf] ?? 0;
      while (i + 1 < arr.length && arr[i + 1].timestamp.getTime() <= ts) i++;
      cursors[tf] = i;
      const candidate = arr[i];
      rows[tf] = candidate && candidate.timestamp.getTime() <= ts ? candidate : null;
    }
    result.push({ t: ts, rows });
  }
  return result;
}

function packOhlcv(r: Ohlcv | null): number[] {
  if (!r) return [0,0,0,0,0];
  return [r.open, r.high, r.low, r.close, r.volume];
}

export function buildMtfFeatureRow(
  row: { base: Ohlcv; aligned: Record<string, Ohlcv | null> },
  orderedTfs: string[],
  indicatorRow?: number[],
  smcRow?: number[],
): number[] {
  // Features: OHLCV per timeframe in user-specified order
  const feats: number[] = [];
  for (const tf of orderedTfs) {
    const r = tf === '__base__' ? row.base : row.aligned[tf] || null;
    feats.push(...packOhlcv(r));
  }
  if (indicatorRow && indicatorRow.length) feats.push(...indicatorRow);
  if (smcRow && smcRow.length) feats.push(...smcRow);
  return feats;
}

type IndRow = { [key: string]: number | null };

async function loadIndicatorMap(symbol: string, timeframe: string, fields: string[]): Promise<Map<number, IndRow>> {
  if (!fields.length) return new Map();
  const inds = await prisma.indicator.findMany({ where: { symbol, timeframe }, orderBy: { timestamp: 'asc' } });
  const map = new Map<number, IndRow>();
  for (const i of inds) {
    const row: IndRow = {};
    for (const f of fields) {
      // Only include requested columns if present on the row
      // @ts-ignore
      row[f] = (i as any)[f] ?? null;
    }
    map.set(i.timestamp.getTime(), row);
  }
  return map;
}

export async function buildMtfWindow(params: { symbol: string; timeframes: string[]; lookback: number; limit?: number; indicators?: string[]; smcFeatures?: string[] }) {
  const { symbol, timeframes, lookback } = params;
  if (!timeframes.length) throw new Error('timeframes is empty');
  const baseTf = pickBaseTimeframe(timeframes);
  const ordered = ['__base__', ...timeframes.filter(tf => tf !== baseTf).sort((a, b) => timeframeToMs(a) - timeframeToMs(b))];

  // Load generous limits so we can ffill reliably
  const base = await loadSeries(symbol, baseTf, (params.limit ?? 5000));
  if (base.length < lookback + 2) throw new Error('Not enough base timeframe data');
  const others: Record<string, Ohlcv[]> = {};
  for (const tf of timeframes) {
    if (tf === baseTf) continue;
    others[tf] = await loadSeries(symbol, tf, (params.limit ?? 5000));
  }

  // Optional indicators per timeframe: only load requested fields
  const indicatorsByTf: Record<string, Map<number, IndRow> | undefined> = {};
  const indicatorFields = (params.indicators || []).filter(Boolean);
  if (indicatorFields.length) {
    for (const tf of timeframes) {
      indicatorsByTf[tf] = await loadIndicatorMap(symbol, tf, indicatorFields);
    }
  }

  const aligned = alignMtf(base, others);
  // Build rolling windows
  const windows: { ts: Date; feats: number[][] }[] = [];
  for (let i = lookback - 1; i < base.length; i++) {
    const sliceBase = base.slice(i - (lookback - 1), i + 1);
    const rows = sliceBase.map((bRow) => {
      const ar = aligned.find(a => a.t === bRow.timestamp.getTime());
      return { base: bRow, aligned: ar ? ar.rows : {} };
    });
    const feats = rows.map((r) => {
      // Indicators: merge by closest timestamp in each TF (use exact ts if available, else last known earlier)
      let indVals: number[] | undefined;
      if (indicatorFields.length) {
        const indArr: number[] = [];
        for (const tf of timeframes) {
          const ts = (tf === baseTf ? r.base.timestamp.getTime() : (r.aligned[tf]?.timestamp.getTime() ?? r.base.timestamp.getTime()));
          const map = indicatorsByTf[tf];
          let chosen: IndRow | undefined;
          if (map && map.has(ts)) {
            chosen = map.get(ts);
          } else if (map) {
            // Map is not ordered by key iteration; fallback linear scan (acceptable for current scale)
            let bestTs = -Infinity; let best: IndRow | undefined;
            for (const [k, v] of map.entries()) { if (k <= ts && k > bestTs) { bestTs = k; best = v; } }
            chosen = best;
          }
          for (const f of indicatorFields) {
            indArr.push((chosen && typeof chosen[f] === 'number' ? (chosen[f] as number) : 0) as number);
          }
        }
        indVals = indArr;
      }
      // SMC feature flags computed on base slice element-wise per time step
      let smcVals: number[] | undefined;
      if (params.smcFeatures && params.smcFeatures.length) {
        smcVals = computeSmcFlagsForSlice(sliceBase, params.smcFeatures);
      }
      return buildMtfFeatureRow(r, ordered, indVals, smcVals);
    });
    windows.push({ ts: base[i].timestamp, feats });
  }
  return { baseTf, orderedTfs: ordered, windows };
}
