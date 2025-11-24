import { IndicatorModule } from '../interfaces'

export const RSI: IndicatorModule = {
  kind: 'indicator',
  name: 'rsi',
  compute(ctx, params) {
    const length = Math.max(1, Math.floor((params?.length as number) || 14))
    const closes = ctx.candles.map(c => c.close)
    if (closes.length < length + 1) return NaN
    let gains = 0, losses = 0
    for (let i = closes.length - length; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1]
      if (diff >= 0) gains += diff; else losses -= diff
    }
    const avgGain = gains / length
    const avgLoss = losses / length
    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }
}
