import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fetch market status for indices and BTC from Yahoo Finance public endpoint
// Symbols:
//  - S&P 500: ^GSPC
//  - NASDAQ Composite: ^IXIC
//  - BTC-USD: BTC-USD

// Simple in-memory cache to reduce upstream calls and avoid rate-limit errors
type Cached = { data: any[]; isOpen: boolean; ts: number; source: 'live' | 'cache' | 'fallback' } | null;
let CACHE: Cached = null;
const TTL_MS = 120_000; // 2 minutes

function computeIsOpen(data: any[]) {
  return data.some(d => (d.symbol === 'BTC-USD' ? true : (d.marketState || '').toUpperCase() === 'REGULAR'));
}

function fallbackData(): { data: any[]; isOpen: boolean } {
  const data = [
    { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC', changePct: 0, marketState: 'CLOSED' },
    { key: 'sp500', label: 'S&P 500', symbol: '^GSPC', changePct: 0, marketState: 'CLOSED' },
    { key: 'btc', label: 'BTC/USD', symbol: 'BTC-USD', changePct: 0, marketState: 'REGULAR' },
  ];
  return { data, isOpen: true };
}

async function fetchYahooOnce() {
  const url = 'https://query2.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EIXIC,BTC-USD';
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://finance.yahoo.com/',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items: any[] = json?.quoteResponse?.result || [];

    const map: Record<string, { name: string; symbol: string; changePct: number; marketState: string } > = {};
    for (const it of items) {
      const symbol = String(it.symbol);
      const changePct = typeof it.regularMarketChangePercent === 'number' ? it.regularMarketChangePercent : 0;
      const marketState = String(it.marketState || 'CLOSED');
      map[symbol] = {
        name: String(it.shortName || it.longName || symbol),
        symbol,
        changePct,
        marketState,
      };
    }

    const data = [
      { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC', changePct: map['^IXIC']?.changePct ?? 0, marketState: map['^IXIC']?.marketState ?? 'CLOSED' },
      { key: 'sp500', label: 'S&P 500', symbol: '^GSPC', changePct: map['^GSPC']?.changePct ?? 0, marketState: map['^GSPC']?.marketState ?? 'CLOSED' },
      { key: 'btc', label: 'BTC/USD', symbol: 'BTC-USD', changePct: map['BTC-USD']?.changePct ?? 0, marketState: 'REGULAR' },
    ];
    const isOpen = computeIsOpen(data);
    return { data, isOpen };
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  // Serve from cache if fresh
  const now = Date.now();
  if (CACHE && now - CACHE.ts < TTL_MS) {
    return NextResponse.json({ success: true, isOpen: CACHE.isOpen, data: CACHE.data, source: CACHE.source });
  }

  // Try live fetch with one retry
  let result = await fetchYahooOnce();
  if (!result) {
    // small jitter before retry
    await new Promise((r) => setTimeout(r, 250));
    result = await fetchYahooOnce();
  }

  if (result) {
    CACHE = { ...result, ts: now, source: 'live' };
    return NextResponse.json({ success: true, isOpen: result.isOpen, data: result.data, source: 'live' });
  }

  // Fallback and cache it briefly to avoid repeated upstream hits
  const fb = fallbackData();
  CACHE = { ...fb, ts: now, source: 'fallback' };
  return NextResponse.json({ success: true, isOpen: fb.isOpen, data: fb.data, source: 'fallback' });
}
