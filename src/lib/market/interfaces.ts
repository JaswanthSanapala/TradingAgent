export type TradingHours = {
  sessions?: Array<{ day?: string; open: string; close: string }>
  timezone?: string
  continuous?: boolean
}

export type Instrument = {
  symbol: string
  market: 'forex' | 'crypto' | 'equity' | 'commodity' | 'index' | 'futures' | 'other'
  baseCurrency?: string
  quoteCurrency?: string
  tickSize?: number // minimum price increment
  lotSize?: number  // minimum size increment (e.g., shares=1, crypto=0.0001)
  minNotional?: number
  tradingHours?: TradingHours
}

export type Candle = { timestamp: Date; open: number; high: number; low: number; close: number; volume?: number; timeframe?: string; symbol?: string }

export interface MarketProvider {
  getInstrument(symbol: string): Promise<Instrument | null>
  getCandles(params: { symbol: string; timeframe?: string; from?: Date; to?: Date; limit?: number }): Promise<Candle[]>
  normalizePrice(symbol: string, price: number): Promise<number>
  normalizeSize(symbol: string, size: number): Promise<number>
}
