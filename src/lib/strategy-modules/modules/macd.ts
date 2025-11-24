import { IndicatorModule } from '../interfaces'

export const MACD: IndicatorModule = {
  kind: 'indicator',
  name: 'macd',
  compute(ctx, params) {
    const fast = Math.max(1, Math.floor((params?.fast as number) || 12))
    const slow = Math.max(fast + 1, Math.floor((params?.slow as number) || 26))
    const signal = Math.max(1, Math.floor((params?.signal as number) || 9))
    const closes = ctx.candles.map(c => c.close)
    if (closes.length < slow + signal + 5) return { macd: NaN, signal: NaN, hist: NaN }
    const ema = (arr: number[], len: number) => {
      const k = 2 / (len + 1)
      let prev = arr.slice(0, len).reduce((a, b) => a + b, 0) / len
      for (let i = len; i < arr.length; i++) prev = arr[i] * k + prev * (1 - k)
      return prev
    }
    const macdLine = ema(closes, fast) - ema(closes, slow)
    const histSeries: number[] = []
    // Build series of macd to compute signal EMA
    const macdSeries: number[] = []
    {
      const kf = 2 / (fast + 1), ks = 2 / (slow + 1)
      let emaF = closes[0], emaS = closes[0]
      for (let i = 1; i < closes.length; i++) {
        emaF = closes[i] * kf + emaF * (1 - kf)
        emaS = closes[i] * ks + emaS * (1 - ks)
        macdSeries.push(emaF - emaS)
      }
    }
    const signalLine = (() => {
      const k = 2 / (signal + 1)
      let prev = macdSeries.slice(0, signal).reduce((a, b) => a + b, 0) / signal
      for (let i = signal; i < macdSeries.length; i++) prev = macdSeries[i] * k + prev * (1 - k)
      return prev
    })()
    const hist = macdLine - signalLine
    return { macd: macdLine, signal: signalLine, hist }
  }
}
