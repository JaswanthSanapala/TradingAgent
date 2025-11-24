import { IndicatorContext,PatternModule } from '../interfaces'

function isBullish(c: { open: number; close: number }) { return c.close > c.open }
function isBearish(c: { open: number; close: number }) { return c.close < c.open }

export const Engulfing: PatternModule = {
  kind: 'pattern',
  name: 'engulfing',
  detect(ctx: IndicatorContext) {
    const arr = ctx.candles
    if (arr.length < 2) return false
    const a = arr[arr.length - 2]
    const b = arr[arr.length - 1]
    // Real body engulf condition
    const bodyA = { high: Math.max(a.open, a.close), low: Math.min(a.open, a.close) }
    const bodyB = { high: Math.max(b.open, b.close), low: Math.min(b.open, b.close) }
    const bullishEngulf = isBearish(a) && isBullish(b) && bodyB.high >= bodyA.high && bodyB.low <= bodyA.low
    const bearishEngulf = isBullish(a) && isBearish(b) && bodyB.high >= bodyA.high && bodyB.low <= bodyA.low
    return bullishEngulf || bearishEngulf
  }
}
