import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/datasets/:id/jobs -> list ingest jobs for a coverage manifest
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ ok: false, error: 'dataset id is required' }, { status: 400 });

    const dataset = await prisma.coverageManifest.findUnique({ where: { id } });
    if (!dataset) return NextResponse.json({ ok: false, error: 'dataset not found' }, { status: 404 });

    const jobs = await prisma.ingestJob.findMany({ where: { manifestId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ ok: true, jobs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
