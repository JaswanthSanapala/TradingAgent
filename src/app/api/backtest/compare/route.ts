import { NextRequest, NextResponse } from 'next/server';
import { BacktestEngine } from '@/lib/backtest-engine';
import { logger } from '@/lib/logger';

// POST /api/backtest/compare - Compare multiple backtest results
export const POST = async (request: NextRequest) => {
  try {
    const { backtestIds } = await request.json();

    if (!backtestIds || !Array.isArray(backtestIds) || backtestIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 backtest IDs are required for comparison' },
        { status: 400 }
      );
    }

    const backtestEngine = new BacktestEngine({} as any);
    const ids: string[] = backtestIds.map((id: any) => String(id));
    const comparison = await backtestEngine.compareBacktests(ids);

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    logger.error('Error comparing backtests:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}