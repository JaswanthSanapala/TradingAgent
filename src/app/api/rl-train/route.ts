import { NextRequest, NextResponse } from 'next/server';
import { RLTrainer, RLConfig, TrainingEnvironment } from '@/lib/rl-trainer';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/rl-train/train - Train an agent using reinforcement learning
export const POST = async (request: NextRequest) => {
  try {
    const { agentId, strategyId, config } = await request.json();

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

    // Create RL config
    const rlConfig: RLConfig = {
      algorithm: config?.algorithm || 'ppo',
      learningRate: config?.learningRate || 0.001,
      totalTimesteps: config?.totalTimesteps || 100000,
      batchSize: config?.batchSize || 32,
      gamma: config?.gamma || 0.99,
      explorationRate: config?.explorationRate || 0.1,
      memorySize: config?.memorySize || 10000,
      targetUpdateInterval: config?.targetUpdateInterval || 1000,
    };

    // Create training environment
    const trainingEnvironment: TrainingEnvironment = {
      stateSize: config?.stateSize || 50,
      actionSize: config?.actionSize || 3,
      maxSteps: config?.maxSteps || 1000,
      rewardThreshold: config?.rewardThreshold || 100,
    };

    const rlTrainer = new RLTrainer(rlConfig, trainingEnvironment);
    const result = await rlTrainer.trainAgent(agentId, strategyId);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Agent training completed successfully',
    });
  } catch (error) {
    logger.error('Error training agent:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET /api/rl-train/progress/:agentId - Get training progress for an agent
export const GET = async (request: NextRequest, { params }: { params: { agentId: string } }) => {
  try {
    const { agentId } = params;

    const rlTrainer = new RLTrainer({} as RLConfig, {} as TrainingEnvironment);
    const progress = await rlTrainer.getLearningProgress(agentId);

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error('Error getting training progress:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}