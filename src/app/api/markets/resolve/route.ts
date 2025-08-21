import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';

export const dynamic = 'force-dynamic';

type ResolveResult = {
  ok: boolean;
  input: string;
  exchangeId: string;
  unified?: string; // e.g., BTC/USDT
  storageSymbol?: string; // e.g., BTC_USDT
  matched: boolean;
  suggestions?: Array<{ unified: string; storageSymbol: string; score: number }>;
  error?: string;
};

function norm(s: string) {
  return s.replace(/[\s_-]+/g, '/').toUpperCase();
}

function scoreSymbol(input: string, candidate: string): number {
  const a = norm(input);
  const b = norm(candidate);
  if (a === b) return 1.0;
  // simple token overlap score
  const [ab, aq] = a.split('/');
  const [bb, bq] = b.split('/');
  let score = 0;
  if (ab === bb) score += 0.4;
  if (aq === bq) score += 0.4;
  if (ab === bq || aq === bb) score += 0.1; // reversed
  // char overlap
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get('symbol') || '').trim();
    const exchangeId = (searchParams.get('exchangeId') || 'binance').trim();
    if (!input) return NextResponse.json({ ok: false, error: 'symbol is required' } as ResolveResult, { status: 400 });

    if (!(ccxt as any)[exchangeId]) {
      return NextResponse.json({ ok: false, error: 'unsupported exchangeId', input, exchangeId } as ResolveResult, { status: 400 });
    }

    const markets = await loadMarkets(exchangeId);
    const symbols: string[] = Object.values(markets).map((m: any) => m.symbol);

    // try exact/unified matches
    const canon = norm(input);
    const direct = symbols.find(s => norm(s) === canon);
    if (direct) {
      return NextResponse.json({ ok: true, input, exchangeId, unified: direct, storageSymbol: direct.replace('/', '_'), matched: true } as ResolveResult);
    }

    // suggestions
    const scored = symbols.map(s => ({ s, score: scoreSymbol(input, s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .filter(x => x.score > 0.2);

    return NextResponse.json({
      ok: true,
      input,
      exchangeId,
      matched: false,
      suggestions: scored.map(x => ({ unified: x.s, storageSymbol: x.s.replace('/', '_'), score: Number(x.score.toFixed(3)) })),
    } as ResolveResult, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || 'resolve failed' } as ResolveResult, { status: 500 });
  }
}
