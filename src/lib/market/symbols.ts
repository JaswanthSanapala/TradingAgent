import ccxt from 'ccxt';

export type ResolvedSymbol = {
  unified: string; // e.g., BTC/USDT
  storageSymbol: string; // e.g., BTC_USDT
};

export type ResolveResponse =
  | { ok: true; matched: true; exchangeId: string; input: string; result: ResolvedSymbol }
  | { ok: true; matched: false; exchangeId: string; input: string; suggestions: Array<ResolvedSymbol & { score: number }> }
  | { ok: false; error: string; exchangeId: string; input: string };

function norm(s: string) {
  return s.replace(/[\s_-]+/g, '/').toUpperCase();
}

function scoreSymbol(input: string, candidate: string): number {
  const a = norm(input);
  const b = norm(candidate);
  if (a === b) return 1.0;
  const [ab, aq] = a.split('/');
  const [bb, bq] = b.split('/');
  let score = 0;
  if (ab === bb) score += 0.4;
  if (aq === bq) score += 0.4;
  if (ab === bq || aq === bb) score += 0.1;
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const inter = [...setA].filter(c => setB.has(c)).length;
  score += Math.min(0.1, inter / Math.max(10, setB.size));
  return score;
}

async function loadMarkets(exchangeId: string) {
  const g = global as any;
  g.__markets_cache__ = g.__markets_cache__ || new Map<string, any>();
  const key = `mkts:${exchangeId}`;
  if (g.__markets_cache__.has(key)) return g.__markets_cache__.get(key);
  const ex = new (ccxt as any)[exchangeId]();
  const markets = await ex.loadMarkets();
  g.__markets_cache__.set(key, markets);
  return markets;
}

export async function resolveSymbol(exchangeId: string, input: string): Promise<ResolveResponse> {
  const symbol = input.trim();
  if (!symbol) return { ok: false, error: 'symbol is required', exchangeId, input: symbol };
  if (!(ccxt as any)[exchangeId]) {
    return { ok: false, error: 'unsupported exchangeId', exchangeId, input: symbol };
  }

  const markets = await loadMarkets(exchangeId);
  const symbols: string[] = Object.values(markets).map((m: any) => m.symbol);
  const canon = norm(symbol);
  const direct = symbols.find(s => norm(s) === canon);
  if (direct) {
    return {
      ok: true,
      matched: true,
      exchangeId,
      input: symbol,
      result: { unified: direct, storageSymbol: direct.replace('/', '_') },
    };
  }

  const suggestions = symbols
    .map(s => ({ s, score: scoreSymbol(symbol, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .filter(x => x.score > 0.2)
    .map(x => ({ unified: x.s, storageSymbol: x.s.replace('/', '_'), score: Number(x.score.toFixed(3)) }));

  return { ok: true, matched: false, exchangeId, input: symbol, suggestions };
}

// Heuristics to detect crypto-like symbols
function looksCrypto(input: string): boolean {
  const s = input.trim().toUpperCase();
  return /\//.test(s) || /_/.test(s) || /(USDT|USD|USDC|BTC|ETH)$/.test(s);
}

function sanitizeStorageSymbol(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

const YAHOO_MAP: Record<string, string> = {
  'NIFTY': '^NSEI',
  'BANKNIFTY': '^NSEBANK',
  'SENSEX': '^BSESN',
  'SPX': '^GSPC',
  'S&P500': '^GSPC',
  'DOW': '^DJI',
  'NASDAQ': '^IXIC',
  'NIFTY50': '^NSEI',
};

export type AutoResolveResponse =
  | { ok: true; matched: true; exchangeId: string; input: string; result: ResolvedSymbol }
  | { ok: true; matched: false; exchangeId: string; input: string; suggestions: Array<ResolvedSymbol & { score: number }> }
  | { ok: false; error: string; input: string };

// Try multiple sources: crypto via ccxt short-list, otherwise map to Yahoo Finance ticker
export async function autoResolveSymbol(input: string): Promise<AutoResolveResponse> {
  const symbol = input.trim();
  if (!symbol) return { ok: false, error: 'symbol is required', input: symbol };

  // 1) Crypto via popular exchanges
  if (looksCrypto(symbol)) {
    const shortlist = ['binance', 'kraken', 'coinbase', 'bybit'];
    for (const ex of shortlist) {
      try {
        const r = await resolveSymbol(ex, symbol);
        if (r.ok && (r as any).matched) return r as any;
      } catch {}
    }
    // Aggregate best suggestions from first exchange as a fallback
    try {
      const r = await resolveSymbol(shortlist[0], symbol);
      if (r.ok && !(r as any).matched) return r as any;
    } catch {}
  }

  // 2) Indices/Stocks via Yahoo Finance mapping heuristics (no network call; just mapping)
  const upper = symbol.toUpperCase();
  const mapped = YAHOO_MAP[upper] || upper;
  // If user already provided a Yahoo-like ticker (e.g., RELIANCE.NS, AAPL, BTC-USD), accept as-is
  const yfTicker = mapped;
  const storage = sanitizeStorageSymbol(`YF_${yfTicker}`);
  return { ok: true, matched: true, exchangeId: 'yahoo', input: symbol, result: { unified: yfTicker, storageSymbol: storage } };
}

// Helpers for Yahoo storage symbols
export function storageSymbolToYahooTicker(storageSymbol: string): string {
  let s = storageSymbol.trim();
  if (s.toUpperCase().startsWith('YF_')) s = s.slice(3);
  if (s.startsWith('_')) s = '^' + s.slice(1);
  s = s.replace(/_/g, '.');
  const KNOWN_INDEX_TICKERS = new Set(['NSEI', 'NSEBANK', 'BSESN', 'GSPC', 'DJI', 'IXIC']);
  const plain = s.replace(/^\^/, '');
  if (KNOWN_INDEX_TICKERS.has(plain)) s = '^' + plain;
  return s;
}

export function isYahooIndexStorageSymbol(storageSymbol: string): boolean {
  const t = storageSymbolToYahooTicker(storageSymbol);
  if (!t) return false;
  if (t.startsWith('^')) return true;
  const KNOWN_INDEX_TICKERS = new Set(['NSEI', 'NSEBANK', 'BSESN', 'GSPC', 'DJI', 'IXIC']);
  return KNOWN_INDEX_TICKERS.has(t.toUpperCase());
}
