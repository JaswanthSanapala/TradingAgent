import { NextRequest, NextResponse } from 'next/server';
import { DataPipeline, DataPipelineConfig } from '@/lib/data-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { symbol, timeframe, start, end, exchangeId } = body || {};

    if (!symbol || !timeframe || !start || !end) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: symbol, timeframe, start, end' },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid start or end date' },
        { status: 400 }
      );
    }

    const config: DataPipelineConfig = {
      exchange: {
        id: exchangeId || 'binance',
        sandbox: false,
      },
      timeframes: {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
      },
      indicators: {
        atrPeriod: 14,
        cciPeriod: 20,
        smaPeriods: [20, 50],
        rsiPeriod: 14,
      },
      database: {
        path: './db/custom.db',
        backupEnabled: false,
        cleanupDays: 3650,
      },
      symbols: [symbol],
    };

    const pipeline = new DataPipeline(config);
    const { inserted } = await pipeline.backfillRange(symbol, timeframe, startDate, endDate);

    return NextResponse.json({ success: true, symbol, timeframe, inserted });
  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
