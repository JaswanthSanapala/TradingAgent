import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { queues, defaultJobOpts, ExportJobData } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// POST /api/datasets/:id/export
// Body: { from?: string(ISO), to?: string(ISO) }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ ok: false, error: 'dataset id is required' }, { status: 400 });

    const dataset = await prisma.coverageManifest.findUnique({ where: { id } });
    if (!dataset) return NextResponse.json({ ok: false, error: 'dataset not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { from, to } = body || {};

    const jobData: ExportJobData = { datasetId: id, from, to };
    const job = await queues.data_export.add('dataset_export', jobData, defaultJobOpts);

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
