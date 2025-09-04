import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { trainSupervised, trainWalkForward, tuneSupervised } from '@/lib/supervised-trainer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json().catch(() => ({}));
    const {
      symbol = 'BTC_USDT',
      timeframe = '1h',
      lookback = 128,
      lookahead = 8,
      epochs = 8,
      batchSize = 64,
      limit = 5000,
      learningRate,
      mode = 'standard', // 'standard' | 'walk_forward' | 'tune'
      labelingMode = 'future_return', // 'future_return' | 'imitation_strategy'
      strategySource,
      // walk-forward options
      folds,
      step,
      ratios,
      // tuning options
      grid,
      walkForward,
    } = body || {};

    // Basic validation
    const validModes = new Set(['standard', 'walk_forward', 'tune']);
    if (!validModes.has(mode)) {
      return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
    }
    if (typeof symbol !== 'string' || typeof timeframe !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid symbol/timeframe' }, { status: 400 });
    }
    const isPosInt = (v: any) => Number.isInteger(v) && v > 0;
    if (![lookback, lookahead, epochs, batchSize, limit].every(isPosInt)) {
      return NextResponse.json({ success: false, error: 'lookback, lookahead, epochs, batchSize, limit must be positive integers' }, { status: 400 });
    }
    if (learningRate !== undefined && !(typeof learningRate === 'number' && learningRate > 0 && learningRate < 1)) {
      return NextResponse.json({ success: false, error: 'learningRate must be in (0,1)' }, { status: 400 });
    }
    // labeling validation
    const validLabeling = new Set(['future_return', 'imitation_strategy']);
    if (!validLabeling.has(labelingMode)) {
      return NextResponse.json({ success: false, error: 'Invalid labelingMode' }, { status: 400 });
    }
    if (labelingMode === 'imitation_strategy') {
      if (!strategySource || typeof strategySource !== 'object') {
        return NextResponse.json({ success: false, error: 'strategySource is required for imitation_strategy' }, { status: 400 });
      }
      const { type, path: spath } = strategySource as any;
      if (type !== 'js') {
        return NextResponse.json({ success: false, error: 'Only JS strategySource.type="js" is supported currently' }, { status: 400 });
      }
      if (!spath || typeof spath !== 'string') {
        return NextResponse.json({ success: false, error: 'strategySource.path must be a string' }, { status: 400 });
      }
    }
    // Validate ratios if provided (applies to all modes)
    if (ratios) {
      const { train, val, test } = ratios as any;
      const ok = [train, val, test].every((x) => typeof x === 'number' && x >= 0) && Math.abs((train ?? 0) + (val ?? 0) + (test ?? 0) - 1) < 1e-6;
      if (!ok) return NextResponse.json({ success: false, error: 'ratios.train/val/test must sum to 1' }, { status: 400 });
    }
    if (mode === 'walk_forward') {
      if ((folds !== undefined && !isPosInt(folds)) || (step !== undefined && !isPosInt(step))) {
        return NextResponse.json({ success: false, error: 'folds/step must be positive integers' }, { status: 400 });
      }
    }
    if (mode === 'tune' && grid) {
      const { learningRates, batchSizes, epochs: e } = grid as any;
      if (learningRates && !Array.isArray(learningRates)) return NextResponse.json({ success: false, error: 'grid.learningRates must be array' }, { status: 400 });
      if (batchSizes && !Array.isArray(batchSizes)) return NextResponse.json({ success: false, error: 'grid.batchSizes must be array' }, { status: 400 });
      if (e && !Array.isArray(e)) return NextResponse.json({ success: false, error: 'grid.epochs must be array' }, { status: 400 });
      if (walkForward) {
        const { folds: wfFolds, step: wfStep } = walkForward as any;
        if ((wfFolds !== undefined && !isPosInt(wfFolds)) || (wfStep !== undefined && !isPosInt(wfStep))) {
          return NextResponse.json({ success: false, error: 'walkForward.folds/step must be positive integers' }, { status: 400 });
        }
      }
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { strategy: true } });
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    // Route per mode
    if (mode === 'walk_forward') {
      const result = await trainWalkForward({
        agentId,
        strategyId: agent.strategyId,
        symbol,
        timeframe,
        lookback,
        lookahead,
        epochs,
        batchSize,
        limit,
        learningRate,
        labelingMode,
        strategySource,
        folds,
        step,
        ratios,
      });
      return NextResponse.json({ success: true, mode, ...result });
    } else if (mode === 'tune') {
      const result = await tuneSupervised({
        agentId,
        strategyId: agent.strategyId,
        symbol,
        timeframe,
        lookback,
        lookahead,
        epochs,
        batchSize,
        limit,
        labelingMode,
        strategySource,
        grid,
        walkForward,
        ratios,
      });
      return NextResponse.json({ success: true, mode, ...result });
    } else {
      const result = await trainSupervised({
        agentId,
        strategyId: agent.strategyId,
        symbol,
        timeframe,
        lookback,
        lookahead,
        epochs,
        batchSize,
        limit,
        learningRate,
        labelingMode,
        strategySource,
        ratios,
      });
      return NextResponse.json({ success: true, mode: 'standard', ...result });
    }
  } catch (error) {
    console.error('Supervised train failed:', error);
    return NextResponse.json({ success: false, error: 'Training failed' }, { status: 500 });
  }
}
