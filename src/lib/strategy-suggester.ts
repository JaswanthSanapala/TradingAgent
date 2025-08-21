import { prisma } from '@/lib/db';

export type Suggestion = { path: string; op: 'set' | 'inc' | 'dec'; value: number; rationale: string; confidence: number };

export async function getAggregateSuggestions(params: { strategyId: string; window?: number }) {
  const window = params.window ?? 200; // last N feedbacks
  const feedbacks = await prisma.feedbackEvent.findMany({
    where: {
      OR: [
        { trade: { strategyId: params.strategyId } },
        { prediction: { strategyId: params.strategyId } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: window,
    include: { prediction: true, trade: true },
  });

  let sl = 0, tp = 0, closed = 0;
  for (const f of feedbacks) {
    const res = (f.outcome as any)?.result as string | undefined;
    if (res === 'sl') sl++;
    else if (res === 'tp') tp++;
    else closed++;
  }

  const total = feedbacks.length || 1;
  const slRate = sl / total;
  const tpRate = tp / total;

  const suggestions: Suggestion[] = [];
  if (slRate > 0.5) {
    suggestions.push({ path: 'risk.atrMultiplier', op: 'inc', value: 0.25, rationale: `High SL rate (${(slRate*100).toFixed(0)}%)`, confidence: 0.7 });
  }
  if (tpRate > 0.4) {
    suggestions.push({ path: 'risk.riskReward', op: 'inc', value: 0.2, rationale: `Good TP rate (${(tpRate*100).toFixed(0)}%), consider stretching RR`, confidence: 0.5 });
  }
  if (slRate > 0.4 && tpRate < 0.2) {
    suggestions.push({ path: 'signals.minConfidence', op: 'inc', value: 0.05, rationale: 'Filter lower-confidence entries', confidence: 0.55 });
  }

  return { counts: { sl, tp, closed, total }, suggestions };
}

export function applySuggestion(params: { current: any; suggestion: Suggestion }) {
  // immutably apply a single suggestion to a parameters object
  const { current, suggestion } = params;
  const next = structuredClone(current ?? {});
  const keys = suggestion.path.split('.');
  let obj: any = next;
  for (let i = 0; i < keys.length - 1; i++) {
    obj[keys[i]] = obj[keys[i]] ?? {};
    obj = obj[keys[i]];
  }
  const k = keys[keys.length - 1];
  const base = typeof obj[k] === 'number' ? obj[k] : 0;
  if (suggestion.op === 'set') obj[k] = suggestion.value;
  if (suggestion.op === 'inc') obj[k] = base + suggestion.value;
  if (suggestion.op === 'dec') obj[k] = base - suggestion.value;
  return next;
}
