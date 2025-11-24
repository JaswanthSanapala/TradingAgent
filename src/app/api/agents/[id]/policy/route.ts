import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { parameters: true } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    const policy = (agent.parameters as any)?.policy || {};
    return NextResponse.json({ success: true, policy });
  } catch (error) {
    console.error('Get policy failed:', error);
    return NextResponse.json({ success: false, error: 'Get policy failed' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json().catch(() => ({}));
    const { enabled, minConfidence, riskPct, maxSize } = body as { enabled?: boolean; minConfidence?: number; riskPct?: number; maxSize?: number };

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const paramsJson: any = agent.parameters || {};
    const nextPolicy = {
      ...(paramsJson.policy || {}),
      ...(enabled === undefined ? {} : { enabled }),
      ...(minConfidence == null ? {} : { minConfidence: Number(minConfidence) }),
      ...(riskPct == null ? {} : { riskPct: Number(riskPct) }),
      ...(maxSize == null ? {} : { maxSize: Number(maxSize) }),
    };

    await prisma.agent.update({ where: { id: agentId }, data: { parameters: { ...paramsJson, policy: nextPolicy } } });
    return NextResponse.json({ success: true, policy: nextPolicy });
  } catch (error) {
    console.error('Update policy failed:', error);
    return NextResponse.json({ success: false, error: 'Update policy failed' }, { status: 500 });
  }
}
