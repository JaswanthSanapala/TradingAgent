import { prisma } from '@/lib/db';

export type AnalysisInput = {
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  timestamp: Date;
  action?: 'buy' | 'sell' | 'hold';
  outcome?: 'sl' | 'tp' | 'closed';
  pnlPct?: number | null;
};

export type AnalysisOutput = {
  insights: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high'; data?: any }>;
  suggestions: Array<{ path: string; op: 'set' | 'inc' | 'dec'; value: number; rationale: string; confidence: number }>;
};

export async function analyzeStopLossAndTiming(input: AnalysisInput): Promise<AnalysisOutput> {
  // pull last 300 bars for context
  const md = await prisma.marketData.findMany({
    where: { symbol: input.symbol, timeframe: input.timeframe, timestamp: { lte: input.timestamp } },
    orderBy: { timestamp: 'desc' },
    take: 300,
    include: { indicators: true },
  });
  const rows = md.reverse();
  const last = rows[rows.length - 1];
  const atrSeries = rows.map((r: any) => r.indicators?.[0]?.atr ?? null).filter((v) => v != null) as number[];
  const rsiSeries = rows.map((r: any) => r.indicators?.[0]?.rsi ?? null).filter((v) => v != null) as number[];

  const insights: AnalysisOutput['insights'] = [];
  const suggestions: AnalysisOutput['suggestions'] = [];

  // Volatility context
  if (atrSeries.length > 20) {
    const recent = atrSeries.slice(-1)[0] as number;
    const mean = avg(atrSeries.slice(-100));
    const sd = std(atrSeries.slice(-100));
    const z = sd > 0 ? (recent - mean) / sd : 0;
    if (z > 1) {
      insights.push({ type: 'volatility_spike', message: `ATR z-score ~ ${z.toFixed(2)} (elevated volatility)`, severity: 'medium', data: { z } });
      // Recommendation: widen SL with higher atrMultiplier
      suggestions.push({ path: 'risk.atrMultiplier', op: 'inc', value: 0.25, rationale: 'Elevated volatility increased SL hits', confidence: clamp01(0.5 + Math.min((z - 1) / 3, 0.4)) });
    }
  }

  // Timing context (simple RSI excursion)
  if (rsiSeries.length > 10 && input.action && input.action !== 'hold') {
    const rsi = rsiSeries.at(-1)!;
    if (input.action === 'buy' && rsi > 70) {
      insights.push({ type: 'late_long', message: `RSI ${rsi.toFixed(1)} suggests overbought on long entry`, severity: 'low' });
      suggestions.push({ path: 'signals.minRSIForLong', op: 'inc', value: 2, rationale: 'Avoid chasing overbought', confidence: 0.4 });
    }
    if (input.action === 'sell' && rsi < 30) {
      insights.push({ type: 'late_short', message: `RSI ${rsi.toFixed(1)} suggests oversold on short entry`, severity: 'low' });
      suggestions.push({ path: 'signals.maxRSIForShort', op: 'dec', value: 2, rationale: 'Avoid chasing oversold', confidence: 0.4 });
    }
  }

  // Outcome-based tweak
  if (input.outcome === 'sl') {
    insights.push({ type: 'stop_loss_hit', message: 'Position exited via Stop Loss', severity: 'medium' });
    suggestions.push({ path: 'risk.atrMultiplier', op: 'inc', value: 0.25, rationale: 'Reduce SL hits in similar regimes', confidence: 0.6 });
  }
  if (input.outcome === 'tp') {
    insights.push({ type: 'take_profit_hit', message: 'Position exited via Take Profit', severity: 'low' });
    // modest encouragement to increase RR if TP hits are frequent would be handled in aggregate suggester
  }

  return { insights, suggestions };
}

function avg(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function std(a: number[]) { const m = avg(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : 0; }
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
