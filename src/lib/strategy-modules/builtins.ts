import { ExecutorModule } from './interfaces'
import { ATR } from './modules/atr'
import { BollingerBands } from './modules/bollinger'
import { BoS } from './modules/bos'
import { Engulfing } from './modules/engulfing'
import { MACD } from './modules/macd'
import { RSI } from './modules/rsi'
import { RSIThreshold } from './modules/signals/rsi-threshold'
import { SMA } from './modules/sma'
import { Registry } from './registry'

const DefaultExecutor: ExecutorModule = {
  kind: 'executor',
  name: 'default_executor',
  execute(input, policy, ctx, deps) {
    const { action, price } = input
    if (action === 'hold') return { action }
    const maxRiskPct = (policy?.maxRiskPct ?? 1) / 100 // interpret as % of equity
    const rr = policy?.minRR ?? 2
    const atr = typeof deps.indicators['atr'] === 'number' ? deps.indicators['atr'] : undefined
    // Default to 1% of price if ATR unavailable
    const slDist = atr && atr > 0 ? 1.5 * atr : price * 0.01
    const stopLoss = action === 'buy' ? price - slDist : price + slDist
    const tpDist = slDist * rr
    const takeProfit = action === 'buy' ? price + tpDist : price - tpDist
    return { action, positionSize: maxRiskPct, stopLoss, takeProfit }
  }
}

export function initBuiltins() {
  Registry.registerIndicator(SMA)
  Registry.registerIndicator(RSI)
  Registry.registerIndicator(ATR)
  Registry.registerIndicator(MACD)
  Registry.registerIndicator(BollingerBands)
  Registry.registerPattern(Engulfing)
  Registry.registerPattern(BoS)
  Registry.registerSignal(RSIThreshold)
  Registry.registerExecutor(DefaultExecutor)
}
