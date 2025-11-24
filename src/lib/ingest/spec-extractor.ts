import { compileStrategy } from '@lib/strategy/strategy-compiler'
import { parseSystemMarkdown } from '@lib/strategy/strategy-loader'

import { StrategySpec } from '@/lib/types/strategy'

import { StrategySpecSchema, StrategySpecValidated } from './spec-schema'

export type ExtractOptions = {
  useLLM?: boolean
}

export type ExtractResult = {
  spec: StrategySpecValidated
  warnings: string[]
  provenance: { method: 'system_md' | 'heuristic' | 'llm'; notes?: string }
}

// Phase 1: no external LLM calls. We combine existing validators + compiler metadata heuristics.
export async function extractSpecFromText(text: string, opts?: ExtractOptions): Promise<ExtractResult> {
  const trimmed = (text || '').trim()
  if (!trimmed) throw new Error('Empty text provided')

  // Path A: If text matches our system markdown, use that authoritative parse
  const val = (() => {
    try { return parseSystemMarkdown(trimmed) } catch { return null }
  })()
  if (val) {
    const parsedSpec: StrategySpec = { ...val.spec }
    const validated = StrategySpecSchema.parse(parsedSpec)
    return { spec: validated, warnings: val.warnings || [], provenance: { method: 'system_md' } }
  }

  // Path B: Heuristic via compileStrategy metadata (timeframes, indicators, policy) from free-form text
  const compiled = compileStrategy({ fileName: 'input.txt', fileContent: trimmed })
  const md = compiled.ir?.metadata || {}
  const timeframes: string[] | undefined = md?.mtf?.timeframes
  const indicators: Array<{ name: string; params?: Record<string, number> }> | undefined = md?.indicators
  const risk = md?.policy

  // Seed with compiler-derived fields
  const spec: StrategySpec = {
    timeframes: Array.isArray(timeframes) ? timeframes : undefined,
    indicators: Array.isArray(indicators) ? indicators.slice() : [],
    risk: risk && Object.keys(risk).length ? risk : undefined,
    // rules are free-form; we only include if compileStrategy extracted rules from md
    rules: Array.isArray(compiled.ir?.rules) && compiled.ir?.rules?.length ? compiled.ir?.rules : undefined,
    patterns: undefined,
  }

  // Heuristic keyword/param extraction for new modules
  try {
    const txt = trimmed.toLowerCase()
    const pushIndicator = (name: string, params?: Record<string, number>) => {
      const arr = spec.indicators as Array<{ name: string; params?: Record<string, number> }>
      if (!arr.find(i => i.name.toLowerCase() === name.toLowerCase())) arr.push({ name, params })
    }
    const pushPattern = (name: string) => {
      if (!spec.patterns) spec.patterns = []
      if (!spec.patterns.find(p => p.toLowerCase() === name.toLowerCase())) spec.patterns.push(name)
    }

    // ATR: matches 'ATR(14)' or 'ATR 14' or mentions of 'Average True Range'
    const atrMatch = /atr\s*\(\s*(\d{1,3})\s*\)|atr\s+(\d{1,3})|average true range/ig.exec(trimmed)
    if (atrMatch) {
      const len = Number(atrMatch[1] || atrMatch[2]) || 14
      pushIndicator('atr', { length: len })
    }

    // MACD: 'MACD(12,26,9)' or default if referenced
    const macdMatch = /macd\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/ig.exec(trimmed)
    if (macdMatch) {
      pushIndicator('macd', { fast: Number(macdMatch[1]), slow: Number(macdMatch[2]), signal: Number(macdMatch[3]) })
    } else if (txt.includes('macd')) {
      pushIndicator('macd', { fast: 12, slow: 26, signal: 9 })
    }

    // Bollinger: 'Bollinger(20,2)' or mentions of bands
    const bollMatch = /bollinger\s*\(\s*(\d{1,3})\s*,\s*(\d{1,2}(?:\.\d+)?)\s*\)/ig.exec(trimmed)
    if (bollMatch) {
      pushIndicator('bollinger', { length: Number(bollMatch[1]), mult: Number(bollMatch[2]) as unknown as number })
    } else if (txt.includes('bollinger') || txt.includes('bbands') || txt.includes('bollinger bands')) {
      pushIndicator('bollinger', { length: 20, mult: 2 as unknown as number })
    }

    // BoS (Break of Structure)
    if (/\b(bos|break of structure|break\s+structure)\b/i.test(trimmed)) {
      pushPattern('bos')
    }
  } catch {}

  const validated = StrategySpecSchema.parse(spec)
  return { spec: validated, warnings: [], provenance: { method: 'heuristic', notes: compiled.notes } }
}
