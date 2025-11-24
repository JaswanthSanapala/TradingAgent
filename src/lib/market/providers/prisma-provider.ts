import { prisma } from '@/lib/db'
import { Candle,Instrument, MarketProvider } from '@/lib/market/interfaces'

export class PrismaMarketProvider implements MarketProvider {
  async getInstrument(symbol: string): Promise<Instrument | null> {
    return { symbol, market: 'other' }
  }

  async getCandles(params: { symbol: string; timeframe?: string; from?: Date; to?: Date; limit?: number }): Promise<Candle[]> {
    const { symbol, timeframe, from, to, limit } = params
    const rows = await prisma.marketData.findMany({
      where: {
        symbol,
        ...(timeframe ? { timeframe } : {}),
        ...(from || to ? { timestamp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { timestamp: 'asc' },
      ...(limit ? { take: limit } : {}),
    })
    return rows.map(r => ({ timestamp: r.timestamp, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume || undefined, timeframe: r.timeframe, symbol: r.symbol }))
  }

  async normalizePrice(symbol: string, price: number): Promise<number> {
    return price
  }

  async normalizeSize(symbol: string, size: number): Promise<number> {
    return size
  }
}
