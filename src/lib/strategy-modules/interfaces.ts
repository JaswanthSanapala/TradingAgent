export type IndicatorContext = {
  price: number
  candles: Array<{ open: number; high: number; low: number; close: number; volume?: number; timestamp?: number | Date }>
  indicators: Record<string, any>
  timeframe: string
  symbol: string
}

export interface IndicatorModule {
  kind: 'indicator'
  name: string
  // Returns a numeric or object value for the indicator at the latest bar
  compute(ctx: IndicatorContext, params?: Record<string, number>): any
}

export interface PatternModule {
  kind: 'pattern'
  name: string
  // Returns true if pattern is detected on latest bar
  detect(ctx: IndicatorContext, params?: Record<string, number | string>): boolean
}

export interface SignalModule {
  kind: 'signal'
  name: string
  // Returns a suggested action and optional confidence
  signal(ctx: IndicatorContext, deps: { indicators: Record<string, any>; patterns: Record<string, boolean> }, params?: Record<string, any>): { action: 'buy' | 'sell' | 'hold'; confidence?: number; reason?: string }
}

export interface ExecutorModule {
  kind: 'executor'
  name: string
  // Turn a signal into an order sizing/SL/TP (policy)
  execute(input: { action: 'buy' | 'sell' | 'hold'; confidence?: number; price: number }, policy: { maxRiskPct?: number; minRR?: number } | undefined, ctx: IndicatorContext, deps: { indicators: Record<string, any>; patterns: Record<string, boolean> }): { action: 'buy' | 'sell' | 'hold'; positionSize?: number; stopLoss?: number; takeProfit?: number }
}
