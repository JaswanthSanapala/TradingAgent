import { buildMtfWindow, pickBaseTimeframe } from '@lib/market/mtf';
import { predictAction } from '@lib/ml/ml-utils';
import { PREDICTION_CREATED_EVENT,socketBus } from '@lib/sockets/socket-bus';
import { maybeAutoTrade } from '@lib/trading/auto-trader';
import { prisma } from '@/lib/core/db';

async function getMtfTimeframes(strategyId: string): Promise<string[] | undefined> {
  try {
    const s = await prisma.strategy.findUnique({ where: { id: strategyId }, select: { parameters: true } });
    const p: any = s?.parameters || {};
    const tfs: string[] | undefined = p?.compiled?.metadata?.mtf?.timeframes;
    if (Array.isArray(tfs) && tfs.length) return Array.from(new Set(tfs.map(x => String(x).trim().toLowerCase())));
  } catch {}
  return undefined;
}

async function getStrategyIndicators(strategyId: string): Promise<string[] | undefined> {
  try {
    const s = await prisma.strategy.findUnique({ where: { id: strategyId }, select: { parameters: true } });
    const p: any = s?.parameters || {};
    const inds: string[] | undefined = p?.compiled?.metadata?.indicators;
    if (Array.isArray(inds) && inds.length) return Array.from(new Set(inds.map(x => String(x))));
  } catch {}
  return undefined;
}

async function getSmcFeatures(strategyId: string): Promise<string[] | undefined> {
  try {
    const s = await prisma.strategy.findUnique({ where: { id: strategyId }, select: { parameters: true } });
    const p: any = s?.parameters || {};
    const feats: string[] | undefined = p?.compiled?.metadata?.smc?.features;
    if (Array.isArray(feats) && feats.length) return Array.from(new Set(feats.map(x => String(x))));
  } catch {}
  return undefined;
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

  // Prefer MTF timeframes from strategy IR; fallback to provided timeframe
  const mtf = await getMtfTimeframes(params.strategyId);
  const indicators = await getStrategyIndicators(params.strategyId);
  const smcFeatures = await getSmcFeatures(params.strategyId);
  let feats: number[][];
  let ts: Date;
  let baseClose: number | undefined;
  if (mtf && mtf.length) {
    const { baseTf, windows } = await buildMtfWindow({ symbol: params.symbol, timeframes: mtf, lookback: params.lookback, limit: 5000, indicators: indicators || [], smcFeatures: smcFeatures || [] });
    if (!windows.length) throw new Error('Not enough data for MTF prediction');
    const last = windows[windows.length - 1];
    feats = last.feats;
    ts = last.ts as Date;
    const lastRow = await prisma.marketData.findFirst({ where: { symbol: params.symbol, timeframe: baseTf, timestamp: ts }, select: { close: true } });
    baseClose = lastRow?.close;
  } else {
    const md = await prisma.marketData.findMany({
      where: { symbol: params.symbol, timeframe: params.timeframe },
      orderBy: { timestamp: 'desc' },
      take: params.lookback + 1,
    });
    if (md.length < params.lookback) throw new Error('Not enough data for prediction');
    const rows = md.reverse().slice(-params.lookback);
    // If indicators requested in strategy, join them for single timeframe
    let indMap: Map<number, any> | undefined;
    const fields = indicators && indicators.length ? indicators : [];
    if (fields.length) {
      const tsList = rows.map(r => r.timestamp);
      const inds = await prisma.indicator.findMany({ where: { symbol: params.symbol, timeframe: params.timeframe, timestamp: { in: tsList } } });
      indMap = new Map(inds.map(i => [i.timestamp.getTime(), i]));
    }
    feats = rows.map((r) => {
      const base = [r.open, r.high, r.low, r.close, r.volume];
      if (!indMap || !fields.length) return base;
      const row = indMap.get(r.timestamp.getTime());
      const ext = fields.map(f => (row && typeof (row as any)[f] === 'number') ? (row as any)[f] as number : 0);
      return base.concat(ext);
    });
    ts = rows[rows.length - 1].timestamp as Date;
    baseClose = rows[rows.length - 1].close;
  }

  const { action, confidence, probs } = await predictAction(agent.modelPath, feats);

  // No indicator-derived SL/TP here (user requested no indicators). Leave sizing to execution policy or strategy params.
  let stopLoss: number | undefined;
  let takeProfit: number | undefined;

  const rationale = `${action?.toUpperCase?.()}: Conf ${(confidence * 100).toFixed(0)}%`;

  const prediction = await prisma.tradePrediction.create({
    data: {
      agentId: params.agentId,
      strategyId: params.strategyId,
      symbol: params.symbol,
      timeframe: mtf && mtf.length ? pickBaseTimeframe(mtf) : params.timeframe,
      timestamp: ts,
      features: { lookback: params.lookback, mtf: mtf && mtf.length ? mtf : undefined },
      action,
      confidence,
      stopLoss,
      takeProfit,
      meta: { probs, price: baseClose ?? null, rationale, status: 'pending' },
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

  // Auto-trading: attempt execution based on policy (dev default ON)
  try {
    const policy = (agent as any)?.parameters?.policy;
    await maybeAutoTrade({
      prediction: {
        id: prediction.id,
        agentId: prediction.agentId,
        strategyId: prediction.strategyId,
        symbol: prediction.symbol,
        timeframe: prediction.timeframe,
        action: prediction.action as any,
        confidence: prediction.confidence,
      },
      policy,
    });
  } catch {}

  return prediction;
}
