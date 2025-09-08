import ccxt from 'ccxt';
import { CONFIG } from '@/lib/config';

let exchange: any | null = null;

function getExchange(): any {
  if (exchange) return exchange;
  const id = (CONFIG.EXCHANGE_ID || 'binance') as keyof typeof ccxt;
  const Cls: any = (ccxt as any)[id];
  if (!Cls) throw new Error(`Unsupported exchange: ${CONFIG.EXCHANGE_ID}`);
  exchange = new Cls({
    apiKey: CONFIG.EXCHANGE_API_KEY || undefined,
    secret: CONFIG.EXCHANGE_SECRET || undefined,
    enableRateLimit: true,
    timeout: 30000,
  });
  if (typeof (exchange as any).setSandboxMode === 'function') {
    (exchange as any).setSandboxMode(!!CONFIG.EXCHANGE_SANDBOX);
  }
  return exchange;
}

export async function getBalance() {
  const ex = getExchange();
  const bal = await ex.fetchBalance();
  return bal;
}

export async function getOpenOrders(symbol?: string) {
  const ex = getExchange();
  if (symbol) return ex.fetchOpenOrders(symbol);
  // fetch open orders for all symbols is not standard; return empty or require symbol
  return [];
}

export async function placeOrder(opts: { symbol: string; side: 'buy' | 'sell'; type: 'market' | 'limit'; amount: number; price?: number; params?: any; }) {
  const ex = getExchange();
  const { symbol, side, type, amount, price, params } = opts;
  if (type === 'market') return ex.createMarketOrder(symbol, side, amount, params);
  if (price == null) throw new Error('price is required for limit orders');
  return ex.createLimitOrder(symbol, side, amount, price, params);
}

export async function cancelOrder(opts: { orderId: string; symbol: string; params?: any; }) {
  const ex = getExchange();
  const { orderId, symbol, params } = opts;
  return ex.cancelOrder(orderId, symbol, params);
}

export async function getTickerPrice(symbol: string): Promise<number> {
  const ex = getExchange();
  const t = await ex.fetchTicker(symbol);
  const p = t.last ?? t.close ?? t.bid ?? t.ask;
  if (p == null) throw new Error('Unable to determine ticker price');
  return Number(p);
}

export async function fetchOrder(symbol: string, id: string): Promise<any> {
  const ex = getExchange();
  return ex.fetchOrder(id, symbol);
}

// Best-effort OCO placement for Binance spot only
export async function placeOcoOrder(opts: { symbol: string; side: 'buy'|'sell'; amount: number; takeProfit: number; stopLoss: number; params?: any; }) {
  const ex: any = getExchange();
  const isBinance = (ex?.id || '').toLowerCase() === 'binance';
  if (!isBinance) throw new Error('OCO not supported for this exchange in this helper');
  const marketId = ex.marketId(opts.symbol);
  const side = opts.side.toUpperCase(); // 'SELL' for closing longs
  const quantity = opts.amount;
  const price = opts.takeProfit; // TP limit price
  const stopPrice = opts.stopLoss; // SL trigger
  const stopLimitPrice = opts.stopLoss; // SL limit
  if (typeof ex.sapiPostOrderOco !== 'function') throw new Error('Binance sapiPostOrderOco not available in this ccxt build');
  const params = {
    symbol: marketId,
    side,
    quantity,
    price,
    stopPrice,
    stopLimitPrice,
    stopLimitTimeInForce: 'GTC',
    ...(opts.params || {}),
  };
  return await ex.sapiPostOrderOco(params);
}
