import { NextRequest, NextResponse } from 'next/server';
import { resolveSymbol } from '@/lib/symbols';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get('symbol') || '').trim();
    const exchangeId = (searchParams.get('exchangeId') || 'binance').trim();

    const result = await resolveSymbol(exchangeId, input);
    const status = result.ok ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'resolve failed' }, { status: 500 });
  }
}
