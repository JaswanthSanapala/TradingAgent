import { NextRequest, NextResponse } from 'next/server';
import { trainUnsupervised } from '@/lib/trainer';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { symbol = 'BTC_USDT', timeframe = '1h', windowSize = 512, maskRatio = 0.15, epochs = 2, limit = 2000 } = body || {};

    const result = await trainUnsupervised({ symbol, timeframe, windowSize, maskRatio, epochs, limit });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    logger.error('Training error', { err: String(err?.stack || err?.message || err) });
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
