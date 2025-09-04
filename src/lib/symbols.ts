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
