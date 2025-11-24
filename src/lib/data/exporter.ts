import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

// Using parquetjs-lite for simple Parquet writing
// Schema is a flat table combining OHLCV + selected indicators
export async function exportToParquet(params: {
  symbol: string;
  timeframe: string;
  start: Date;
  end: Date;
  outDir?: string; // default data/ohlcv
}): Promise<{ rows: number; filePath: string }> {
  const { symbol, timeframe, start, end } = params;
  const outDir = params.outDir || path.join(process.cwd(), 'data', 'ohlcv', `symbol=${sanitize(symbol)}`, `timeframe=${timeframe}`);

  // Fetch market data in ascending order
  const md = await prisma.marketData.findMany({
    where: {
      symbol,
      timeframe,
      timestamp: { gte: start, lt: end },
    },
    orderBy: { timestamp: 'asc' },
  });

  if (md.length === 0) {
    const filePath = path.join(outDir, `empty_${Date.now()}.parquet`);
    await ensureDir(outDir);
    await fs.writeFile(filePath, Buffer.alloc(0));
    return { rows: 0, filePath };
  }

  // Grab indicators for matching timestamps
  const timestamps = md.map(r => r.timestamp);
  const inds = await prisma.indicator.findMany({
    where: {
      symbol,
      timeframe,
      timestamp: { in: timestamps },
    },
  });
  const indMap = new Map<number, typeof inds[number]>();
  for (const i of inds) indMap.set(i.timestamp.getTime(), i);

  // Build rows
  const rows = md.map(row => {
    const i = indMap.get(row.timestamp.getTime());
    return {
      timestamp: row.timestamp.getTime(),
      symbol,
      timeframe,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      // indicators (nullable)
      atr: i?.atr ?? null,
      cci: i?.cci ?? null,
      rsi: i?.rsi ?? null,
      macd: i?.macd ?? null,
      macdSignal: i?.macdSignal ?? null,
      macdHistogram: i?.macdHistogram ?? null,
      bbUpper: i?.bbUpper ?? null,
      bbMiddle: i?.bbMiddle ?? null,
      bbLower: i?.bbLower ?? null,
      swingHigh: i?.swingHigh ?? null,
      swingLow: i?.swingLow ?? null,
      bullishEngulfing: i?.bullishEngulfing ?? null,
      bearishEngulfing: i?.bearishEngulfing ?? null,
      doji: i?.doji ?? null,
      sma20: i?.sma20 ?? null,
      sma50: i?.sma50 ?? null,
    };
  });

  // Write Parquet
  await ensureDir(outDir);
  const filePath = path.join(outDir, `part_${Date.now()}.parquet`);

  const { ParquetSchema, ParquetWriter } = await import('parquetjs-lite');
  const schema = new ParquetSchema({
    timestamp: { type: 'INT64' },
    symbol: { type: 'UTF8' },
    timeframe: { type: 'UTF8' },
    open: { type: 'DOUBLE' },
    high: { type: 'DOUBLE' },
    low: { type: 'DOUBLE' },
    close: { type: 'DOUBLE' },
    volume: { type: 'DOUBLE' },
    atr: { type: 'DOUBLE', optional: true },
    cci: { type: 'DOUBLE', optional: true },
    rsi: { type: 'DOUBLE', optional: true },
    macd: { type: 'DOUBLE', optional: true },
    macdSignal: { type: 'DOUBLE', optional: true },
    macdHistogram: { type: 'DOUBLE', optional: true },
    bbUpper: { type: 'DOUBLE', optional: true },
    bbMiddle: { type: 'DOUBLE', optional: true },
    bbLower: { type: 'DOUBLE', optional: true },
    swingHigh: { type: 'DOUBLE', optional: true },
    swingLow: { type: 'DOUBLE', optional: true },
    bullishEngulfing: { type: 'BOOLEAN', optional: true },
    bearishEngulfing: { type: 'BOOLEAN', optional: true },
    doji: { type: 'BOOLEAN', optional: true },
    sma20: { type: 'DOUBLE', optional: true },
    sma50: { type: 'DOUBLE', optional: true },
  });

  const writer = await ParquetWriter.openFile(schema, filePath);
  for (const r of rows) {
    await writer.appendRow(r as any);
  }
  await writer.close();

  // Manifest
  await writeManifest({ outDir, symbol, timeframe, start, end, rows: rows.length });

  logger.info(`Parquet written: ${filePath} (${rows.length} rows)`);
  return { rows: rows.length, filePath };
}

export async function writeManifest(params: {
  outDir: string;
  symbol: string;
  timeframe: string;
  start: Date;
  end: Date;
  rows: number;
}) {
  const manifestPath = path.join(params.outDir, 'manifest.json');
  const entry = {
    symbol: params.symbol,
    timeframe: params.timeframe,
    start: params.start.toISOString(),
    end: params.end.toISOString(),
    rows: params.rows,
    createdAt: new Date().toISOString(),
    version: 1,
  };
  await ensureDir(params.outDir);
  try {
    const existing = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as any[];
    existing.push(entry);
    await fs.writeFile(manifestPath, JSON.stringify(existing, null, 2));
  } catch {
    await fs.writeFile(manifestPath, JSON.stringify([entry], null, 2));
  }
}

function sanitize(sym: string) {
  return sym.replace(/\//g, '_');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}
