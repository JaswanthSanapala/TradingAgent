import { IndicatorModule } from '../interfaces'

export const BollingerBands: IndicatorModule = {
  kind: 'indicator',
  name: 'bollinger',
  compute(ctx, params) {
    const length = Math.max(1, Math.floor((params?.length as number) || 20))
    const mult = Number(params?.mult ?? 2)
    const closes = ctx.candles.map(c => c.close)
    if (closes.length < length) return { upper: NaN, middle: NaN, lower: NaN, bandwidth: NaN, percentB: NaN }
    const slice = closes.slice(-length)
    const mean = slice.reduce((a, b) => a + b, 0) / length
    const variance = slice.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / length
    const std = Math.sqrt(variance)
    const upper = mean + mult * std
    const lower = mean - mult * std
    const price = closes[closes.length - 1]
    const bandwidth = (upper - lower) / mean
    const percentB = (price - lower) / (upper - lower)
    return { upper, middle: mean, lower, bandwidth, percentB }
  }
}
