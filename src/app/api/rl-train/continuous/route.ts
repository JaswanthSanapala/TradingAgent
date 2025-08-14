import { NextRequest, NextResponse } from 'next/server';
import { RLTrainer, RLConfig, TrainingEnvironment } from '@/lib/rl-trainer';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/rl-train/continuous - Start continuous learning for an agent
export const POST = async (request: NextRequest) => {
  try {
    const { agentId, strategyId } = await request.json();

    if (!agentId || !strategyId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    // Validate agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const rlTrainer = new RLTrainer({} as RLConfig, {} as TrainingEnvironment);
    await rlTrainer.continuousLearning(agentId, strategyId);

    return NextResponse.json({
      success: true,
      message: 'Continuous learning process completed',
    });
  } catch (error) {
    logger.error('Error in continuous learning:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}