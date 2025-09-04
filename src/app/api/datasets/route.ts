import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSymbol } from '@/lib/symbols';

export const dynamic = 'force-dynamic';

// GET /api/datasets -> list coverage manifests (datasets)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || undefined;
    const timeframe = searchParams.get('timeframe') || undefined;
    const exchangeId = searchParams.get('exchangeId') || undefined;

    // If any filters provided, return filtered list (or first match semantics are handled by client)
    if (symbol || timeframe || exchangeId) {
      const storageSymbol = symbol ? symbol.replace('/', '_') : undefined;
      const items = await prisma.coverageManifest.findMany({
        where: {
          ...(storageSymbol ? { symbol: storageSymbol } : {}),
          ...(timeframe ? { timeframe } : {}),
          ...(exchangeId ? { exchangeId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ ok: true, items });
    }

    const items = await prisma.coverageManifest.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}

// POST /api/datasets -> create dataset (validates symbol via unified resolver)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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

    const resolved = await resolveSymbol(exchangeId, symbol);
    if (!resolved.ok) return NextResponse.json(resolved, { status: 400 });
    if (resolved.ok && !resolved.matched) {
      return NextResponse.json({ ok: false, error: 'unrecognized symbol', suggestions: resolved.suggestions }, { status: 400 });
    }

    const storageSymbol = resolved.result.storageSymbol;
    const created = await prisma.coverageManifest.create({
      data: { symbol: storageSymbol, timeframe, exchangeId, startDate: start, endDate: end, notes: notes || null },
    });
    return NextResponse.json({ ok: true, item: created });
  } catch (e: any) {
    if (String(e?.message || '').includes('Unique constraint failed')) {
      return NextResponse.json({ ok: false, error: 'A dataset with the same symbol/timeframe/exchange and date range already exists' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}

// DELETE /api/datasets?id=... or JSON { id }
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json().catch(() => ({}));
        id = body?.id;
      } catch {}
    }
    if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });

    const existing = await prisma.coverageManifest.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'dataset not found' }, { status: 404 });

    await prisma.coverageManifest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}

