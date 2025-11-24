import ccxt from 'ccxt';
import { CONFIG } from '@/lib/config';
import { prisma } from '@/lib/db';

let exchange: any | null = null;
let cachedCfg: { provider: string; apiKey?: string | null; apiSecret?: string | null; sandbox?: boolean | null } | null = null;
let lastCfgLoad = 0;

async function loadActiveConfig(): Promise<typeof cachedCfg> {
  const now = Date.now();
  // refresh every 10s
  if (cachedCfg && now - lastCfgLoad < 10000) return cachedCfg;
  try {
    const cfg = await prisma.apiConfiguration.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    if (cfg) {
      cachedCfg = { provider: cfg.provider, apiKey: cfg.apiKey, apiSecret: cfg.apiSecret, sandbox: cfg.sandbox };
    } else {
      cachedCfg = null;
    }
    lastCfgLoad = now;
  } catch {
    cachedCfg = null;
  }
  return cachedCfg;
}

export function reloadBroker() {
  exchange = null;
  cachedCfg = null;
  lastCfgLoad = 0;
}

function resolveId(id: string | undefined): string {
  if (!id) return 'binance';
  return id.toLowerCase();
}

async function buildExchange(): Promise<any> {
  // Prefer DB config if available
  const db = await loadActiveConfig();
  const exId = resolveId(db?.provider || CONFIG.EXCHANGE_ID || 'binance');
  const Cls: any = (ccxt as any)[exId];
  if (!Cls) throw new Error(`Unsupported exchange: ${exId}`);
  const apiKey = db?.apiKey ?? (CONFIG.EXCHANGE_API_KEY || undefined);
  const secret = db?.apiSecret ?? (CONFIG.EXCHANGE_SECRET || undefined);
  const sandbox = (db?.sandbox ?? CONFIG.EXCHANGE_SANDBOX) ? true : false;
  const ex = new Cls({ apiKey, secret, enableRateLimit: true, timeout: 30000 });
  if (typeof (ex as any).setSandboxMode === 'function') {
    (ex as any).setSandboxMode(!!sandbox);
  }
  return ex;
}

async function getExchange(): Promise<any> {
  if (exchange) return exchange;
  exchange = await buildExchange();
  return exchange;
}

export async function getBalance() {
  const ex = await getExchange();
  const bal = await ex.fetchBalance();
  return bal;
}

export async function getOpenOrders(symbol?: string) {
  const ex = await getExchange();
  if (symbol) return ex.fetchOpenOrders(symbol);
  // fetch open orders for all symbols is not standard; return empty or require symbol
  return [];
}

export async function placeOrder(opts: { symbol: string; side: 'buy' | 'sell'; type: 'market' | 'limit'; amount: number; price?: number; params?: any; }) {
  const ex = await getExchange();
  const { symbol, side, type, amount, price, params } = opts;
  if (type === 'market') return ex.createMarketOrder(symbol, side, amount, params);
  if (price == null) throw new Error('price is required for limit orders');
  return ex.createLimitOrder(symbol, side, amount, price, params);
}

export async function cancelOrder(opts: { orderId: string; symbol: string; params?: any; }) {
  const ex = await getExchange();
  const { orderId, symbol, params } = opts;
  return ex.cancelOrder(orderId, symbol, params);
}

export async function getTickerPrice(symbol: string): Promise<number> {
  const ex = await getExchange();
  const t = await ex.fetchTicker(symbol);
  const p = t.last ?? t.close ?? t.bid ?? t.ask;
  if (p == null) throw new Error('Unable to determine ticker price');
  return Number(p);
}

export async function fetchOrder(symbol: string, id: string): Promise<any> {
  const ex = await getExchange();
  return ex.fetchOrder(id, symbol);
}

// Best-effort OCO placement for Binance spot only
export async function placeOcoOrder(opts: { symbol: string; side: 'buy'|'sell'; amount: number; takeProfit: number; stopLoss: number; params?: any; }) {
  const ex: any = await getExchange();
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

// Fetch recent OHLCV candles for a symbol/timeframe
// Returns array of [timestamp, open, high, low, close, volume]
export async function fetchOHLCV(symbol: string, timeframe: string, limit: number = 2): Promise<number[][]> {
  const ex = getExchange();
  // ccxt standard fetchOHLCV
  const candles: any[] = await ex.fetchOHLCV(symbol, timeframe, undefined, limit);
  return candles as number[][];
}
