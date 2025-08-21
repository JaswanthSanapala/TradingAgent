import { NextRequest, NextResponse } from 'next/server';
import { exportToParquet } from '@/lib/exporter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { symbol, timeframe, start, end } = body || {};

    if (!symbol || !timeframe || !start || !end) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: symbol, timeframe, start, end' },
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

    const { rows, filePath } = await exportToParquet({ symbol, timeframe, start: startDate, end: endDate });
    return NextResponse.json({ success: true, rows, filePath });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
