import { IndicatorModule } from '../interfaces'

export const ATR: IndicatorModule = {
  kind: 'indicator',
  name: 'atr',
  compute(ctx, params) {
    const length = Math.max(1, Math.floor((params?.length as number) || 14))
    const candles = ctx.candles
    if (candles.length < length + 1) return NaN
    let sumTR = 0
    for (let i = candles.length - length; i < candles.length; i++) {
      const c = candles[i]
      const p = candles[i - 1]
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close)
      )
      sumTR += tr
    }
    return sumTR / length
  }
}
