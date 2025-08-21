import { prisma } from '@/lib/db';
import { predictAction } from '@/lib/supervised-trainer';

function buildFeatures(row: any) {
  const { open, high, low, close, volume } = row;
  const rsi = row.rsi ?? 50;
  const macd = row.macd ?? 0;
  const macdSignal = row.macdSignal ?? 0;
  const bbUpper = row.bbUpper ?? close;
  const bbLower = row.bbLower ?? close;
  const atr = row.atr ?? 0;
  const spreadBB = bbUpper - bbLower || 1e-6;
  return [
    close,
    volume,
    rsi,
    macd,
    macdSignal,
    (close - bbLower) / spreadBB,
    atr,
    (high - low) / (close || 1e-6),
  ];
}

export async function predictForAgent(params: {
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  lookback: number;
}) {
  const agent = await prisma.agent.findUnique({ where: { id: params.agentId } });
  if (!agent || !agent.modelPath) throw new Error('Agent or model not found');

  // Load latest window
  const md = await prisma.marketData.findMany({
    where: { symbol: params.symbol, timeframe: params.timeframe },
    orderBy: { timestamp: 'desc' },
    take: params.lookback + 1,
    include: { indicators: true },
  });
  if (md.length < params.lookback) throw new Error('Not enough data for prediction');
  const rows = md.reverse().slice(-params.lookback);
  const feats = rows.map((r) => buildFeatures({ ...r, ...(r as any).indicators?.[0] }));

  const { action, confidence, probs } = await predictAction(agent.modelPath, feats);

  // Risk sizing via ATR multiplier from strategy parameters (fallback defaults)
  const strategy = await prisma.strategy.findUnique({ where: { id: params.strategyId } });
  const sParams: any = strategy?.parameters || {};
  const atrMult = sParams.risk?.atrMultiplier ?? 1.5;
  const rr = sParams.risk?.riskReward ?? 1.5;

  const last = rows[rows.length - 1];
  const atr = (rows[rows.length - 1] as any).indicators?.[0]?.atr ?? 0;
  let stopLoss: number | undefined;
  let takeProfit: number | undefined;
  if (action === 'buy') {
    stopLoss = last.close - atrMult * atr;
    takeProfit = last.close + rr * (last.close - (stopLoss ?? last.close));
  } else if (action === 'sell') {
    stopLoss = last.close + atrMult * atr;
    takeProfit = last.close - rr * ((stopLoss ?? last.close) - last.close);
  }

  const prediction = await prisma.tradePrediction.create({
    data: {
      agentId: params.agentId,
      strategyId: params.strategyId,
      symbol: params.symbol,
      timeframe: params.timeframe,
      timestamp: last.timestamp,
      features: { lookback: params.lookback },
      action,
      confidence,
      stopLoss,
      takeProfit,
      meta: { probs },
    },
  });

  return prediction;
}
