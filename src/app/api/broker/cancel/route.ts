import { NextRequest, NextResponse } from 'next/server';
import { queues, defaultJobOpts, BrokerJobData } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// POST /api/broker/cancel
// Body: { orderId, symbol, params? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, symbol, params } = body || {};
    if (!orderId || !symbol) {
      return NextResponse.json({ ok: false, error: 'orderId and symbol are required' }, { status: 400 });
    }

    const job: BrokerJobData = { action: 'cancel', orderId, symbol, params } as any;
    const enq = await queues.broker_exec.add('cancel_order', job, defaultJobOpts);
    return NextResponse.json({ ok: true, jobId: enq.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
