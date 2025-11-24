import { IndicatorContext,PatternModule } from '../interfaces'

// Simple Break of Structure (BoS) heuristic:
// - Bullish BoS if price closes above recent swing high
// - Bearish BoS if price closes below recent swing low
// Returns true if any BoS event detected on latest bar

function findSwingHigh(candles: IndicatorContext['candles'], lookback: number): number | null {
  if (candles.length < lookback) return null
  let max = -Infinity
  for (let i = candles.length - lookback; i < candles.length - 1; i++) {
    if (candles[i].high > max) max = candles[i].high
  }
  return max === -Infinity ? null : max
}

function findSwingLow(candles: IndicatorContext['candles'], lookback: number): number | null {
  if (candles.length < lookback) return null
  let min = Infinity
  for (let i = candles.length - lookback; i < candles.length - 1; i++) {
    if (candles[i].low < min) min = candles[i].low
  }
  return min === Infinity ? null : min
}

export const BoS: PatternModule = {
  kind: 'pattern',
  name: 'bos',
  detect(ctx, params) {
    const lookback = Math.max(5, Math.floor(Number(params?.lookback ?? 20)))
    const swingsHigh = findSwingHigh(ctx.candles, lookback)
    const swingsLow = findSwingLow(ctx.candles, lookback)
    const last = ctx.candles[ctx.candles.length - 1]
    if (!last) return false
    if (swingsHigh != null && last.close > swingsHigh) return true
    if (swingsLow != null && last.close < swingsLow) return true
    return false
  }
}
