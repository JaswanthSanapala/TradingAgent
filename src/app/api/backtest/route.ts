import { NextRequest, NextResponse } from 'next/server';
import { BacktestEngine, BacktestConfig } from '@/lib/backtest-engine';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/backtest - Get backtest results
export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const backtestEngine = new BacktestEngine({} as BacktestConfig);
    const results = await backtestEngine.getBacktestResults(limit, offset);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    logger.error('Error getting backtest results:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/backtest/run - Run backtest for an agent
export const POST = async (request: NextRequest) => {
  try {
    const { agentId, strategyId, config } = await request.json();

    if (!agentId || !strategyId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    // Validate agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { strategy: true },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Create backtest config
    const backtestConfig: BacktestConfig = {
      startDate: new Date(config?.startDate || Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(config?.endDate || Date.now()),
      symbol: config?.symbol || 'EUR/USD',
      timeframe: config?.timeframe,
      initialBalance: config?.initialBalance || 10000,
      maxRiskPerTrade: config?.maxRiskPerTrade || 0.01,
      maxTradesPerDay: config?.maxTradesPerDay || 2,
      minRewardRiskRatio: config?.minRewardRiskRatio || 3,
    };

    const backtestEngine = new BacktestEngine(backtestConfig);
    const result = await backtestEngine.runBacktest(agentId, strategyId);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Backtest completed successfully',
    });
  } catch (error) {
    logger.error('Error running backtest:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}