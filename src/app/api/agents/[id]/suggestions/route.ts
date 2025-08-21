import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAggregateSuggestions } from '@/lib/strategy-suggester';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const url = new URL(request.url);
    const window = Number(url.searchParams.get('window') || 200);

    const agg = await getAggregateSuggestions({ strategyId: agent.strategyId, window });
    return NextResponse.json({ success: true, ...agg });
  } catch (error) {
    console.error('Suggestions GET failed:', error);
    return NextResponse.json({ success: false, error: 'Suggestions failed' }, { status: 500 });
  }
}
