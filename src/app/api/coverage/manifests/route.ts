import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import ccxt from 'ccxt';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await prisma.coverageManifest.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, timeframe, exchangeId = 'binance', startDate, endDate, notes } = body || {};
    if (!symbol || !timeframe || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: 'symbol, timeframe, startDate, endDate are required' }, { status: 400 });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid date format' }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ ok: false, error: 'endDate must be after startDate' }, { status: 400 });
    }

    // Resolve and autocorrect symbol using ccxt markets
    if (!(ccxt as any)[exchangeId]) {
      return NextResponse.json({ ok: false, error: `unsupported exchangeId: ${exchangeId}` }, { status: 400 });
    }
    const ex = new (ccxt as any)[exchangeId]();
    const markets = await ex.loadMarkets();
    const symbols: string[] = Object.values(markets).map((m: any) => m.symbol);
    const norm = (s: string) => s.replace(/[\s_-]+/g, '/').toUpperCase();
    const canon = norm(String(symbol));
    const direct = symbols.find(s => norm(s) === canon);
    if (!direct) {
      const scoreSymbol = (input: string, candidate: string): number => {
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
      };
      const suggestions = symbols
        .map(s => ({ s, score: scoreSymbol(symbol, s) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .filter(x => x.score > 0.2)
        .map(x => ({ unified: x.s, storageSymbol: x.s.replace('/', '_'), score: Number(x.score.toFixed(3)) }));
      return NextResponse.json({ ok: false, error: 'unrecognized symbol', suggestions }, { status: 400 });
    }

    const storageSymbol = direct.replace('/', '_'); // save canonical underscore format

    const created = await prisma.coverageManifest.create({
      data: { symbol: storageSymbol, timeframe, exchangeId, startDate: start, endDate: end, notes: notes || null },
    });
    return NextResponse.json({ ok: true, item: created });
  } catch (e: any) {
    console.error(e);
    // handle unique constraint
    if (String(e?.message || '').includes('Unique constraint failed')) {
      return NextResponse.json({ ok: false, error: 'A dataset with the same symbol/timeframe/exchange and date range already exists' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }
    if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });

    // Ensure it exists
    const existing = await prisma.coverageManifest.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'dataset not found' }, { status: 404 });

    await prisma.coverageManifest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
