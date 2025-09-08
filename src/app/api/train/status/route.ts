import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/train/status?runId=... or ?agentId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId') || undefined;
    const agentId = searchParams.get('agentId') || undefined;

    if (!runId && !agentId) {
      return NextResponse.json({ success: false, error: 'runId or agentId is required' }, { status: 400 });
    }

    if (runId) {
      const run = await prisma.trainingRun.findUnique({ where: { id: runId } });
      if (!run) return NextResponse.json({ success: false, error: 'TrainingRun not found' }, { status: 404 });
      return NextResponse.json({ success: true, run });
    }

    // agentId path: return latest run
    const run = await prisma.trainingRun.findFirst({ where: { agentId: agentId! }, orderBy: { createdAt: 'desc' } });
    if (!run) return NextResponse.json({ success: false, error: 'No TrainingRun found for agent' }, { status: 404 });
    return NextResponse.json({ success: true, run });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
