import { StrategySpec } from '@/lib/types/strategy'

import { initBuiltins } from './builtins'
import { IndicatorContext } from './interfaces'
import { Registry } from './registry'

let builtinsInited = false
function ensureBuiltins() {
  if (!builtinsInited) { initBuiltins(); builtinsInited = true }
}

export type ComposeOptions = {
  signals?: Array<{ name: string; params?: Record<string, any> }>
  executor?: { name: string; params?: Record<string, any> }
}

export function composeRuntime(spec: StrategySpec, opts?: ComposeOptions) {
  ensureBuiltins()

  const requestedIndicators = (spec.indicators || []).map(i => ({ name: i.name.toLowerCase(), params: i.params || {} }))
  const requestedPatterns = (spec.patterns || []).map(p => p.toLowerCase())

  // pick signals: if user didn't specify, infer a simple one from indicators
  const signals = (opts?.signals && opts.signals.length)
    ? opts.signals
    : (requestedIndicators.some(i => i.name === 'rsi') ? [{ name: 'rsi_threshold', params: {} }] : [])

  const execName = opts?.executor?.name || 'default_executor'
  const executor = Registry.getExecutor(execName)
  if (!executor) throw new Error(`Executor '${execName}' not found`)

  return {
    // compute action for the latest bar using spec-defined modules
    compute(ctx: IndicatorContext) {
      const indicators: Record<string, any> = {}
      const patterns: Record<string, boolean> = {}
      // compute indicators
      for (const req of requestedIndicators) {
        const mod = Registry.getIndicator(req.name)
        if (!mod) continue
        indicators[req.name] = mod.compute(ctx, req.params)
      }
      // detect patterns
      for (const p of requestedPatterns) {
        const mod = Registry.getPattern(p)
        if (!mod) continue
        patterns[p] = mod.detect(ctx)
      }
      // signals
      let action: 'buy' | 'sell' | 'hold' = 'hold'
      let confidence: number | undefined
      let reason: string | undefined
      for (const s of (signals || [])) {
        const smod = Registry.getSignal(s.name)
        if (!smod) continue
        const out = smod.signal(ctx, { indicators, patterns }, s.params)
        if (out.action !== 'hold') { action = out.action; confidence = out.confidence; reason = out.reason; break }
      }
      // execute policy
      const execOut = executor.execute({ action, confidence, price: ctx.price }, spec.risk, ctx, { indicators, patterns })
      return { action: execOut.action, confidence, reason, positionSize: execOut.positionSize, stopLoss: execOut.stopLoss, takeProfit: execOut.takeProfit, diagnostics: { indicators, patterns } }
    }
  }
}
