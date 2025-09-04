import { prisma } from '@/lib/db';
import { predictAction, buildFeatures } from '@/lib/ml-utils';
import { socketBus, PREDICTION_CREATED_EVENT } from '@/lib/socket-bus';

// buildFeatures imported from '@/lib/ml-utils'

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
  const ind = (rows[rows.length - 1] as any).indicators?.[0] || {};
  const atr = ind?.atr ?? 0;
  let stopLoss: number | undefined;
  let takeProfit: number | undefined;
  if (action === 'buy') {
    stopLoss = last.close - atrMult * atr;
    takeProfit = last.close + rr * (last.close - (stopLoss ?? last.close));
  } else if (action === 'sell') {
    stopLoss = last.close + atrMult * atr;
    takeProfit = last.close - rr * ((stopLoss ?? last.close) - last.close);
  }

  // Build a lightweight rationale string from indicators
  const rsi = ind?.rsi as number | undefined;
  const macd = ind?.macd as number | undefined;
  const macdSignal = ind?.macdSignal as number | undefined;
  const bbUpper = ind?.bbUpper as number | undefined;
  const bbLower = ind?.bbLower as number | undefined;
  const bbPos = bbUpper && bbLower ? (last.close - bbLower) / Math.max(1e-6, (bbUpper - bbLower)) : undefined;
  const macdHist = macd !== undefined && macdSignal !== undefined ? macd - macdSignal : undefined;
  const rationales: string[] = [];
  if (rsi !== undefined) rationales.push(`RSI ${rsi.toFixed(1)}`);
  if (macdHist !== undefined) rationales.push(`MACD hist ${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(3)}`);
  if (bbPos !== undefined) rationales.push(`BB pos ${(bbPos * 100).toFixed(0)}%`);
  rationales.push(`ATR ${atr.toFixed(2)}`);
  rationales.push(`Conf ${(confidence * 100).toFixed(0)}%`);
  const rationale = `${action?.toUpperCase?.()}: ` + rationales.join(', ');

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
      meta: { probs, indicators: ind, price: last.close, rationale, status: 'pending' },
    },
  });

  // Emit socket event for live UI updates
  try {
    socketBus.emit(PREDICTION_CREATED_EVENT, {
      id: prediction.id,
      agentId: prediction.agentId,
      strategyId: prediction.strategyId,
      symbol: prediction.symbol,
      timeframe: prediction.timeframe,
      timestamp: prediction.timestamp.toISOString(),
      action: prediction.action,
      confidence: prediction.confidence,
      stopLoss: prediction.stopLoss ?? null,
      takeProfit: prediction.takeProfit ?? null,
      meta: prediction.meta,
    });
  } catch {}

  return prediction;
}
