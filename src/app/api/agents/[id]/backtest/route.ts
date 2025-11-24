import { BacktestConfig,BacktestEngine } from '@lib/trading/backtest-engine';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/agents/[id]/backtest?limit=20&offset=0
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate agent exists
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const [items, count] = await Promise.all([
      prisma.backtest.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          agent: { select: { id: true, name: true } },
          trades: false,
        },
      }),
      prisma.backtest.count({ where: { agentId } }),
    ]);

    return NextResponse.json({ success: true, items, count, limit, offset });
  } catch (error: any) {
    logger.error('Error listing backtests (agent-scoped):', error);
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/backtest
// Body: { config: Partial<BacktestConfig> }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = params.id;
    const body = await request.json().catch(() => ({}));
    const { config } = body || {} as { config?: Partial<BacktestConfig> };

    // Validate agent exists and get strategyId
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { strategy: true } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const cfg: BacktestConfig = {
      startDate: new Date(config?.startDate || Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(config?.endDate || Date.now()),
      symbol: config?.symbol || 'BTC_USDT',
      timeframe: config?.timeframe || '1h',
      initialBalance: config?.initialBalance ?? 10000,
      maxRiskPerTrade: config?.maxRiskPerTrade ?? 0.01,
      maxTradesPerDay: config?.maxTradesPerDay ?? 10,
      minRewardRiskRatio: config?.minRewardRiskRatio ?? 1.5,
    };

    const engine = new BacktestEngine(cfg);
    const result = await engine.runBacktest(agentId, agent.strategyId);

    return NextResponse.json({ success: true, data: result, message: 'Backtest completed successfully' });
  } catch (error: any) {
    logger.error('Error running backtest (agent-scoped):', error);
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
