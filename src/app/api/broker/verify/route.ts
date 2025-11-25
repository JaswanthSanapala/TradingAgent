import { NextRequest, NextResponse } from 'next/server';

import { getBalance } from '@/lib/trading/broker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const bal = await getBalance();
    // Return a compact summary of key balances if present
    const total = bal?.total || {};
    const free = bal?.free || {};
    const used = bal?.used || {};
    return NextResponse.json({ success: true, balances: { total, free, used } });
  } catch (e: any) {
    const msg = e?.message || 'Broker test failed';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
