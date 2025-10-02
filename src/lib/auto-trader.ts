import { CONFIG } from '@/lib/config';
import { queues } from '@/lib/queue';
import { getBalance, getTickerPrice } from '@/lib/broker';
import { simpleSizeByQuote } from '@/lib/risk';

function toCcxtSymbol(dbSymbol: string): string {
  // 'BTC_USDT' -> 'BTC/USDT'
  return dbSymbol.replace('_', '/');
}

export type AutoTradePolicy = {
  enabled?: boolean;
  minConfidence?: number; // override CONFIG.PREDICTION_MIN_CONF
  riskPct?: number;       // override CONFIG.RISK_PER_TRADE_PCT
  maxSize?: number;       // cap quantity
};

export async function maybeAutoTrade(params: {
  prediction: {
    id: string;
    agentId: string;
    strategyId: string;
    symbol: string;      // DB-style, e.g. BTC_USDT
    timeframe: string;
    action: 'buy'|'sell'|'hold'|string;
    confidence: number;
  };
  policy?: AutoTradePolicy;
}) {
  // Global guards
  if (!CONFIG.REDIS_ENABLED || !CONFIG.EXECUTION_ENABLED) return;
  const { prediction } = params;
  const action = String(prediction.action || '').toLowerCase();
  if (action !== 'buy' && action !== 'sell') return; // only act on buy/sell
  if (CONFIG.DO_NOT_TRADE.includes(prediction.symbol)) return;

  const enabled = params.policy?.enabled ?? true; // default ON for dev as requested
  if (!enabled) return;

  const minConf = params.policy?.minConfidence ?? CONFIG.PREDICTION_MIN_CONF;
  if (Number(prediction.confidence) < Number(minConf)) return;

  // Compute size
  const ccxtSymbol = toCcxtSymbol(prediction.symbol);
  const price = await getTickerPrice(ccxtSymbol);
  const balance = await getBalance();
  const quoteBal = Number(balance?.free?.[CONFIG.QUOTE_CURRENCY] ?? balance?.total?.[CONFIG.QUOTE_CURRENCY] ?? 0);
  const qty = simpleSizeByQuote({ quoteBalance: quoteBal, riskPct: params.policy?.riskPct, price });
  const amount = params.policy?.maxSize != null ? Math.min(qty, params.policy.maxSize) : qty;
  if (amount <= 0) return;

  // Enqueue market order
  await queues.broker_exec.add('place', {
    action: 'place',
    symbol: ccxtSymbol,
    side: action as 'buy'|'sell',
    type: 'market',
    amount,
    agentId: prediction.agentId,
    strategyId: prediction.strategyId,
  });
}
