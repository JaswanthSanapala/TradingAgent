import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CoverageScheduler } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jobs = await prisma.ingestJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ success: true, items: jobs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body || {};
    if (action === 'tick') {
      await CoverageScheduler.instance.tick();
      return NextResponse.json({ success: true, message: 'Scheduler tick executed' });
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
