import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { queues, defaultJobOpts, WindowsJobData } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// POST /api/datasets/:id/windows
// Body: { from?: string(ISO), to?: string(ISO), windowSize: number, stride?: number, maskRatio?: number }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ ok: false, error: 'dataset id is required' }, { status: 400 });

    const dataset = await prisma.coverageManifest.findUnique({ where: { id } });
    if (!dataset) return NextResponse.json({ ok: false, error: 'dataset not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { from, to, windowSize, stride, maskRatio } = body || {};
    if (!windowSize) return NextResponse.json({ ok: false, error: 'windowSize is required' }, { status: 400 });

    const jobData: WindowsJobData = { datasetId: id, from, to, windowSize: Number(windowSize), stride, maskRatio };
    const job = await queues.data_windows.add('dataset_windows', jobData, defaultJobOpts);

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
