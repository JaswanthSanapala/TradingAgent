import { NextRequest, NextResponse } from 'next/server';
import { buildUnsupervisedWindows } from '@/lib/window-builder';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { symbol, timeframe, start, end, windowSize, stride, maskRatio } = body || {};

    if (!symbol || !timeframe || !start || !end || !windowSize) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: symbol, timeframe, start, end, windowSize' },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid start or end date' },
        { status: 400 }
      );
    }

    const { windows, filePath } = await buildUnsupervisedWindows({
      symbol,
      timeframe,
      start: startDate,
      end: endDate,
      windowSize: Number(windowSize),
      stride: stride !== undefined ? Number(stride) : undefined,
      maskRatio: maskRatio !== undefined ? Number(maskRatio) : undefined,
    });

    return NextResponse.json({ success: true, windows, filePath });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
