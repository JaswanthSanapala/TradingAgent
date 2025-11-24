import { StrategySpec } from '@/lib/types/strategy'

export type SystemMdParseResult = {
  spec: StrategySpec
  warnings: string[]
}

// Very lightweight validator for the required sections seen in system_format docs
export function validateSystemMarkdown(md: string): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  // Normalize markdown emphasis and whitespace before testing
  const normalized = md
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*[*#>\-]+\s*/,'').trim())
    .join('\n')
  const checks: Array<{ r: RegExp; label: string }> = [
    { r: /\bOverview\b/i, label: 'Overview' },
    { r: /\bTimeframes\s*:/i, label: 'Timeframes:' },
    { r: /\bRisk Management\s*:/i, label: 'Risk Management:' },
    { r: /\bIndicators\b/i, label: 'Indicators' },
  ]
  for (const { r, label } of checks) {
    if (!r.test(normalized)) errors.push(`Missing required section: ${label}`)
  }
  return { ok: errors.length === 0, errors }
}

function toLines(md: string): string[] {
  return md.split(/\r?\n/)
}

function parseListAfter(label: string, lines: string[]): string[] {
  const out: string[] = []
  let on = false
  for (const raw of lines) {
    const line = raw.trim()
    const clean = line.replace(/^\*+|\*+$/g,'') // strip emphasis
    if (!on && new RegExp(`^${label}\\s*:`, 'i').test(clean)) { on = true; continue }
    if (on) {
      if (!line) break
      const m = clean.match(/^[-*]\s+(.*)$/)
      if (m) out.push(m[1].trim())
      else if (/^[A-Za-z0-9]/.test(clean)) break
    }
  }
  return out
}

export function parseSystemMarkdown(md: string): SystemMdParseResult {
  const lines = toLines(md)
  // Timeframes block
  const timeframes: string[] = []
  let tfOn = false
  for (const raw of lines) {
    const line = raw.trim()
    const clean = line.replace(/^\*+|\*+$/g,'')
    if (/^Timeframes\s*:/i.test(clean)) { tfOn = true; continue }
    if (tfOn) {
      if (!line) break
      // Support optional bullet prefix before timeframe
      const m = clean.match(/^(?:[-*]\s*)?([0-9]+\s*[mhdw]|[0-9]+\s*(?:min|hour|day|week))\s*:/i)
      if (m) {
        let tf = m[1].toLowerCase().replace(/\s+/g,'')
        tf = tf.replace(/min$/, 'm').replace(/hour$/, 'h').replace(/day$/, 'd').replace(/week$/, 'w')
        timeframes.push(tf)
      } else if (/^Risk Management\s*:/i.test(clean)) {
        break
      }
    }
  }
  // Risk settings
  const riskList = parseListAfter('Risk Management', lines)
  const risk: any = {}
  for (const item of riskList) {
    const lower = item.toLowerCase()
    const pct = item.match(/([0-9]+(?:\.[0-9]+)?)%/)
    if (/risk/.test(lower) && pct) risk.maxRiskPct = Number(pct[1])
    const trades = item.match(/max\s*([0-9]+)\s*trades?/i)
    if (trades) risk.maxTradesPerDay = Number(trades[1])
    const rr = item.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/)
    if (rr) risk.minRR = Number(rr[1]) / Number(rr[2])
    const pause = item.match(/pause\s*([0-9]+)\s*hours?.*consecutive\s*losses/i)
    if (pause) risk.pauseAfterConsecLosses = Number(pause[1])
  }
  // Indicators lines
  const indicators: { name: string; params?: Record<string, number> }[] = []
  let indOn = false
  for (const raw of lines) {
    const line = raw.trim()
    const clean = line.replace(/^\*+|\*+$/g,'')
    if (/^Indicators\b/i.test(clean)) { indOn = true; continue }
    if (indOn) {
      if (!line) break
      const m = clean.match(/^[-*]\s*(.+)$/)
      if (!m) break
      const txt = m[1]
      const nm = txt.split(':')[0].trim()
      // parse common forms like "50 SMA", "ATR(14)", "CCI(14)"
      const p = /([a-z]+)\s*\((\d+)\)/i.exec(nm)
      if (p) indicators.push({ name: p[1].toUpperCase(), params: { length: Number(p[2]) } })
      else indicators.push({ name: nm })
    }
  }

  const spec: StrategySpec = {
    timeframes: Array.from(new Set(timeframes)),
    risk,
    indicators,
  }
  return { spec, warnings: [] }
}
