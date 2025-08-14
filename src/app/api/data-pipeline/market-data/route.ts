import { NextRequest, NextResponse } from 'next/server';
import { DataPipeline, DataPipelineConfig } from '@/lib/data-pipeline';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Initialize data pipeline
const dataPipelineConfig: DataPipelineConfig = {
  exchange: {
    apiKey: process.env.EXCHANGE_API_KEY || '',
    secret: process.env.EXCHANGE_API_SECRET || '',
    sandbox: true,
  },
  timeframes: {
    '4h': '4h',
    '1h': '1h',
    '15m': '15m',
  },
  indicators: {
    atrPeriod: 14,
    cciPeriod: 14,
    smaPeriods: [20, 50],
    rsiPeriod: 14,
  },
  database: {
    path: './data/trading.db',
    backupEnabled: true,
    cleanupDays: 30,
  },
  symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
};

const dataPipeline = new DataPipeline(dataPipelineConfig);

// GET /api/data-pipeline/market-data - Get market data
export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'EUR/USD';
    const timeframe = searchParams.get('timeframe') || '1h';
    const limit = parseInt(searchParams.get('limit') || '100');

    const data = await dataPipeline.getMarketData(symbol, timeframe, limit);

    return NextResponse.json({
      success: true,
      data,
      symbol,
      timeframe,
      count: data.length,
    });
  } catch (error) {
    logger.error('Error getting market data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/data-pipeline/market-data - Update market data
export const POST = async (request: NextRequest) => {
  try {
    const { symbol, timeframe } = await request.json();

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { success: false, error: 'Symbol and timeframe are required' },
        { status: 400 }
      );
    }

    const data = await dataPipeline.fetchMarketData(symbol, timeframe);
    await dataPipeline.calculateAndStoreIndicators(symbol, timeframe);

    return NextResponse.json({
      success: true,
      message: `Market data updated for ${symbol} ${timeframe}`,
      recordsCount: data.length,
    });
  } catch (error) {
    logger.error('Error updating market data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}