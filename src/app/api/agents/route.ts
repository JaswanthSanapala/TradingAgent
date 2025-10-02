import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compileStrategy } from '@/lib/strategy-compiler';
import { queues, defaultJobOpts, SupervisedJobData } from '@/lib/queue';

// Durable job queue is used now; remove in-memory tracker

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch agents with their strategy
    const agents = await prisma.agent.findMany({
      include: {
        strategy: true,
        trainingResults: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all strategies and compute which are untrained (no agent yet)
    const strategies = await prisma.strategy.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const strategyIdsWithAgents = new Set(agents.map(a => a.strategyId));
    const untrainedStrategies = strategies.filter(s => !strategyIdsWithAgents.has(s.id));

    return NextResponse.json({ success: true, agents, untrainedStrategies });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyId } = body as { strategyId?: string };

    if (!strategyId) {
      return NextResponse.json({ success: false, error: 'strategyId is required' }, { status: 400 });
    }

    const strategy = await prisma.strategy.findUnique({ where: { id: strategyId } });
    if (!strategy) {
      return NextResponse.json({ success: false, error: 'Strategy not found' }, { status: 404 });
    }

    // Ensure user exists (no auth in this app)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { email: 'default@trading.ai', name: 'Default User' } });
    }

    // Ensure we have a compiled IR for the strategy
    const sParams: any = strategy.parameters || {};
    let compiled = sParams.compiled;
    if (!compiled) {
      const { ir, notes } = compileStrategy({
        name: strategy.name,
        description: strategy.description ?? undefined,
        fileName: sParams.fileName,
        fileContent: sParams.fileContent,
      });
      compiled = ir;
      // Persist compiled IR back to strategy for future reuse
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: { parameters: { ...sParams, compiled: ir, compilerNotes: notes } },
      });
    }

    // Create the agent with initial performance status 'untrained' (no auto-training)
    const agentName = `${strategy.name} Agent`;
    const agent = await prisma.agent.create({
      data: {
        name: agentName,
        algorithm: 'ppo',
        version: 1,
        parameters: {
          lr: 3e-4,
          gamma: 0.99,
          strategyIR: compiled,
          strategyOrigin: compiled?.origin,
        },
        performance: { progress: 0, status: 'untrained' },
        strategyId: strategy.id,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ success: false, error: 'Failed to create agent' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, action } = body as { agentId?: string; action?: 'pause' | 'resume' | 'stop' | 'retry' };
    if (!agentId || !action) return NextResponse.json({ success: false, error: 'agentId and action are required' }, { status: 400 });

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    // Queue-backed controls could be implemented here (pause/resume/stop), but for now just update status
    if (action === 'pause') {
      await prisma.agent.update({ where: { id: agentId }, data: { performance: { ...(agent.performance as any), status: 'paused' } } });
    } else if (action === 'resume') {
      await prisma.agent.update({ where: { id: agentId }, data: { performance: { ...(agent.performance as any), status: 'training' } } });
    } else if (action === 'stop') {
      await prisma.agent.update({ where: { id: agentId }, data: { performance: { ...(agent.performance as any), status: 'stopped' } } });
    } else if (action === 'retry') {
      await prisma.agent.update({ where: { id: agentId }, data: { performance: { progress: 0, status: 'queued' } } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent action failed:', error);
    return NextResponse.json({ success: false, error: 'Action failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { agentId } = body as { agentId?: string };
    if (!agentId) return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 });

    // Delete related results first, then the agent
    await prisma.trainingResult.deleteMany({ where: { agentId } });
    await prisma.agent.delete({ where: { id: agentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete agent failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete agent' }, { status: 500 });
  }
}
