export type Action = {
  type: 'buy' | 'sell' | 'hold'
  confidence?: number
  reason?: string
}

export type RiskSettings = {
  maxRiskPct?: number
  maxTradesPerDay?: number
  minRR?: number
  pauseAfterConsecLosses?: number
}

export type IndicatorRef = {
  name: string
  params?: Record<string, number>
}

export type Condition = {
  lhs: string
  op: '>' | '>=' | '<' | '<=' | '==' | '!='
  rhs: number | string
  timeframe?: string
}

export type StrategySpec = {
  name?: string
  description?: string
  timeframes?: string[]
  indicators?: IndicatorRef[]
  rules?: string[]
  risk?: RiskSettings
  patterns?: string[]
}

export type Ctx = {
  symbol: string
  timeframe: string
  now: Date
  price: number
  indicators: Record<string, any>
  features?: number[][]
}
