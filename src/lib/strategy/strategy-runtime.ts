import { composeRuntime } from '@/lib/strategy-modules/compose'
import { StrategySpec } from '@/lib/types/strategy'

export type RuntimeComputeInput = {
  candles: Array<{ open: number; high: number; low: number; close: number; volume?: number; timestamp?: number | Date }>
  symbol: string
  timeframe: string
}

export type RuntimeComputeOutput = {
  action: 'buy' | 'sell' | 'hold'
  confidence?: number
  reason?: string
  positionSize?: number
  stopLoss?: number
  takeProfit?: number
  diagnostics?: { indicators: Record<string, any>; patterns: Record<string, boolean> }
}

export function buildRuntimeFromSpec(spec: StrategySpec, opts?: { signals?: Array<{ name: string; params?: Record<string, any> }>; executor?: { name: string; params?: Record<string, any> } }) {
  const runtime = composeRuntime(spec, opts)
  return {
    compute(input: RuntimeComputeInput): RuntimeComputeOutput {
      const last = input.candles[input.candles.length - 1]
      const ctx = {
        price: last?.close ?? NaN,
        candles: input.candles,
        indicators: {},
        timeframe: input.timeframe,
        symbol: input.symbol,
      }
      return runtime.compute(ctx)
    }
  }
}
