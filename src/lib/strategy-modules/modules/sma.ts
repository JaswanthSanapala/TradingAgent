import { IndicatorModule } from '../interfaces'

export const SMA: IndicatorModule = {
  kind: 'indicator',
  name: 'sma',
  compute(ctx, params) {
    const length = Math.max(1, Math.floor((params?.length as number) || 14))
    const closes = ctx.candles.slice(-length).map(c => c.close)
    if (closes.length < length) return NaN
    const sum = closes.reduce((a, b) => a + b, 0)
    return sum / length
  }
}
