import { NextRequest, NextResponse } from 'next/server';

import { getBalance } from '@/lib/trading/broker';

export const dynamic = 'force-dynamic';

// GET /api/broker/balance
export async function GET(_req: NextRequest) {
  try {
    const bal = await getBalance();
    return NextResponse.json({ ok: true, balance: bal });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
