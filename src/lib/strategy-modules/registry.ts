import { ExecutorModule,IndicatorModule, PatternModule, SignalModule } from './interfaces'

const indicators = new Map<string, IndicatorModule>()
const patterns = new Map<string, PatternModule>()
const signals = new Map<string, SignalModule>()
const executors = new Map<string, ExecutorModule>()

export const Registry = {
  registerIndicator(mod: IndicatorModule) { indicators.set(mod.name.toLowerCase(), mod) },
  registerPattern(mod: PatternModule) { patterns.set(mod.name.toLowerCase(), mod) },
  registerSignal(mod: SignalModule) { signals.set(mod.name.toLowerCase(), mod) },
  registerExecutor(mod: ExecutorModule) { executors.set(mod.name.toLowerCase(), mod) },
  getIndicator(name: string) { return indicators.get(name.toLowerCase()) },
  getPattern(name: string) { return patterns.get(name.toLowerCase()) },
  getSignal(name: string) { return signals.get(name.toLowerCase()) },
  getExecutor(name: string) { return executors.get(name.toLowerCase()) },
  list() { return { indicators: Array.from(indicators.keys()), patterns: Array.from(patterns.keys()), signals: Array.from(signals.keys()), executors: Array.from(executors.keys()) } }
}
