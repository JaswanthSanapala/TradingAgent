import { SignalModule } from '../../interfaces'

export const RSIThreshold: SignalModule = {
  kind: 'signal',
  name: 'rsi_threshold',
  signal(ctx, deps, params) {
    const overbought = Number(params?.overbought ?? 70)
    const oversold = Number(params?.oversold ?? 30)
    const rsiVal = deps.indicators['rsi']
    if (typeof rsiVal !== 'number' || Number.isNaN(rsiVal)) return { action: 'hold' }
    if (rsiVal <= oversold) return { action: 'buy', confidence: 0.6, reason: 'rsi_oversold' }
    if (rsiVal >= overbought) return { action: 'sell', confidence: 0.6, reason: 'rsi_overbought' }
    return { action: 'hold' }
  }
}
