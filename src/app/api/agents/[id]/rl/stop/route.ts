import { NextRequest, NextResponse } from 'next/server';
import { PPOTrainer } from '@/lib/rl-trainer';

const trainers = (global as any).__ppo_trainers__ as Map<string, PPOTrainer> || new Map<string, PPOTrainer>();
(global as any).__ppo_trainers__ = trainers;

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const t = trainers.get(params.id);
  if (!t) return NextResponse.json({ ok: false, error: 'trainer not running' }, { status: 404 });
  t.stop();
  return NextResponse.json({ ok: true, state: t.status() });
}
