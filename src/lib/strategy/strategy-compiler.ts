import { generateComputeActionsFromRules } from './strategy-generator'

export type StrategyIR = {
  name?: string
  description?: string
  language: 'md' | 'ts' | 'js' | 'py' | 'txt'
  origin: 'markdown' | 'code'
  code?: string
  rules?: string[]
  metadata?: Record<string, any>
}

// Parse SMC feature mentions (bos, choch, ob, fvg, liquidity)
function parseSmcFromText(text: string | null | undefined): string[] {
  if (!text) return []
  const t = text.toLowerCase()
  const f = new Set<string>()
  if (/\bbos\b|break of structure/i.test(text)) f.add('bos')
  if (/\bchoch\b|change of character/i.test(text)) f.add('choch')
  if (/\bob\b|order ?block/i.test(text)) f.add('ob')
  if (/\bfvg\b|fair value gap/i.test(text)) f.add('fvg')
  if (/\bliquidity\b/.test(t)) f.add('liquidity')
  return Array.from(f.values())
}

// Parse indicator mentions like SMA(50), ATR(14), CCI(14), RSI(14), MACD, Bollinger, etc. from free-form text
function parseIndicatorsFromText(text: string | null | undefined): string[] {
  if (!text) return []
  const t = text.toLowerCase()
  const found = new Set<string>()
  const push = (k: string) => found.add(k)
  // Common indicators
  const smaMatches = t.match(/sma\s*\(\s*(\d+)\s*\)/g) || []
  for (const m of smaMatches) {
    const n = (m.match(/\d+/) || [])[0]
    if (n === '20') push('sma20')
    else if (n === '50') push('sma50')
    else push(`sma${n}`)
  }
  if (/\batr\s*\(\s*14\s*\)/.test(t) || /\batr\b/.test(t)) push('atr')
  if (/\bcci\s*\(\s*14\s*\)/.test(t) || /\bcci\b/.test(t)) push('cci')
  if (/\brsi\b/.test(t)) push('rsi')
  if (/\bmacd\b/.test(t)) { push('macd'); push('macdSignal'); push('macdHistogram') }
  if (/\bbollinger|bb\b/.test(t)) { push('bbUpper'); push('bbMiddle'); push('bbLower') }
  return Array.from(found.values())
}

// Parse execution policy cues from text (risk %, max trades/day, rr, pause losses)
function parsePolicyFromText(text: string | null | undefined): any {
  if (!text) return {}
  const p: any = {}
  // max risk per trade
  const risk = text.match(/max\s+([0-9]+(?:\.[0-9]+)?)%\s*risk\s*per\s*trade/i)
  if (risk) p.maxRiskPct = Number(risk[1])
  const risk2 = text.match(/risk\s*:\s*([0-9]+(?:\.[0-9]+)?)%/i)
  if (risk2) p.maxRiskPct = Number(risk2[1])
  // max trades per day
  const maxTrades = text.match(/max\s+([0-9]+)\s*trades?\s*\/\s*day/i)
  if (maxTrades) p.maxTradesPerDay = Number(maxTrades[1])
  // rr ratio like 3:1
  const rr = text.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/)
  if (rr) p.minRR = Number(rr[1]) / Number(rr[2])
  // pause after N consecutive losses
  const pause = text.match(/pause\s+\d+\s*hours?\s*after\s*([0-9]+)\s*consecutive\s*losses?/i)
  if (pause) p.pauseAfterConsecLosses = Number(pause[1])
  return p
}

function detectLanguage(fileName?: string | null, content?: string | null): StrategyIR['language'] {
  const lower = (fileName || '').toLowerCase()
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'ts'
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'js'
  if (lower.endsWith('.py')) return 'py'
  if (lower.endsWith('.md') || /(^|\n)#+\s/.test(content || '')) return 'md'
  return 'txt'
}

// Parse a simple "Timeframes:" section from free-form text/markdown.
// Example:
// Timeframes:
// 4H: Market direction
// 1H: Trend confirmation
// 15m: Entry confirmation
function parseTimeframesFromText(text: string | null | undefined): string[] {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const tfs: string[] = []
  let inBlock = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/^timeframes\s*:/i.test(line)) { inBlock = true; continue }
    if (inBlock) {
      if (!line) break
      // capture tokens like "4H", "1h", "15m" at line start
      const m = line.match(/^([0-9]+\s*[mhdw]|[0-9]+\s*(?:min|hour|day|week))/i)
      if (m) {
        let tf = m[1].toLowerCase().replace(/\s+/g, '')
        // normalize textual forms
        tf = tf.replace(/min$/, 'm').replace(/hour$/, 'h').replace(/day$/, 'd').replace(/week$/, 'w')
        tfs.push(tf)
      } else {
        // end block on first non-matching line
        break
      }
    }
  }
  // Fallback: search anywhere for tokens like 4H, 1H, 15m in a single line after Timeframes:
  if (!tfs.length) {
    const m = text.match(/timeframes\s*:\s*([^\n]+)/i)
    if (m) {
      const parts = m[1].split(/[;,\s]+/).map(s => s.trim()).filter(Boolean)
      for (let p of parts) {
        p = p.toLowerCase()
        if (/^[0-9]+[mhdw]$/.test(p)) tfs.push(p)
      }
    }
  }
  // Deduplicate preserving order
  return Array.from(new Set(tfs))
}

function extractBestCodeFromMarkdown(md: string): { lang?: string; code?: string } {
  // Capture all fenced code blocks
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ lang?: string; code: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(md)) !== null) {
    const lang = match[1]?.toLowerCase();
    const code = match[2];
    blocks.push({ lang, code });
  }
  if (!blocks.length) return {};

  const isJsLike = (l?: string) => !!l && ['js', 'ts', 'javascript', 'typescript'].includes(l);
  const exportsCompute = (c: string) => /export\s+(async\s+)?function\s+computeActions|export\s+default|module\.exports|exports\./.test(c);

  // 1) Prefer JS/TS blocks that export computeActions or default/module exports
  const preferred = blocks.find(b => isJsLike(b.lang) && exportsCompute(b.code));
  if (preferred) return { lang: preferred.lang, code: preferred.code };

  // 2) Otherwise any JS/TS block
  const jsLike = blocks.find(b => isJsLike(b.lang));
  if (jsLike) return { lang: jsLike.lang, code: jsLike.code };

  // 3) Otherwise first block of any language
  const first = blocks[0];
  return { lang: first.lang, code: first.code };
}

function extractRulesFromMarkdown(md: string): string[] {
  // Naive rule extraction: list items or numbered items become rules
  const rules: string[] = []
  const lines = md.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/)
    if (m) rules.push(m[1].trim())
  }
  return rules
}

export function compileStrategy(params: {
  name?: string
  description?: string
  fileName?: string | null
  fileContent?: string | null
}): { ir: StrategyIR; notes?: string } {
  const { name, description, fileName, fileContent } = params
  const language = detectLanguage(fileName, fileContent)

  if (!fileContent || !fileContent.trim()) {
    return {
      ir: {
        name,
        description,
        language: 'txt',
        origin: 'code',
        code: '',
        metadata: { reason: 'empty_content' },
      },
      notes: 'No content provided; created empty IR',
    }
  }

  if (language === 'md') {
    const { lang, code } = extractBestCodeFromMarkdown(fileContent)
    const rules = extractRulesFromMarkdown(fileContent)
    const mtf = parseTimeframesFromText(fileContent)
    const indicators = parseIndicatorsFromText(fileContent)
    const policy = parsePolicyFromText(fileContent)
    const smc = parseSmcFromText(fileContent)
    // Map js-like aliases to our supported language set
    let inferredLang: StrategyIR['language'] = 'md'
    if (lang) {
      const l = lang.toLowerCase()
      if (l === 'javascript' || l === 'js') inferredLang = 'js'
      else if (l === 'typescript' || l === 'ts') inferredLang = 'ts'
      else if (l === 'py' || l === 'python') inferredLang = 'py'
      else inferredLang = 'md'
    }

    if (code) {
      return {
        ir: {
          name,
          description,
          language: inferredLang,
          origin: 'code',
          code,
          metadata: { source: 'markdown', fileName, ...(mtf.length ? { mtf: { timeframes: mtf } } : {}), ...(indicators.length ? { indicators } : {}), ...(Object.keys(policy).length ? { policy } : {}), ...(smc.length ? { smc: { features: smc } } : {}) },
        },
        notes: 'Extracted best JS/TS code block from markdown',
      }
    }

    // No code block but we have rules: generate a computeActions scaffold
    if (!code && rules.length) {
      const gen = generateComputeActionsFromRules({ name, description, rules })
      return {
        ir: {
          name,
          description,
          language: 'js',
          origin: 'code',
          code: gen.code,
          rules,
          metadata: { source: 'markdown_generated', fileName, ...(mtf.length ? { mtf: { timeframes: mtf } } : {}), ...(indicators.length ? { indicators } : {}), ...(Object.keys(policy).length ? { policy } : {}), ...(smc.length ? { smc: { features: smc } } : {}) },
        },
        notes: gen.notes,
      }
    }

    // No code and no rules
    return {
      ir: {
        name,
        description,
        language: 'md',
        origin: 'markdown',
        code: undefined,
        rules: undefined,
        metadata: { source: 'markdown', fileName, ...(mtf.length ? { mtf: { timeframes: mtf } } : {}), ...(indicators.length ? { indicators } : {}), ...(Object.keys(policy).length ? { policy } : {}), ...(smc.length ? { smc: { features: smc } } : {}) },
      },
      notes: 'No code or recognizable rules found in markdown',
    }
  }

  // Treat as code file
  return {
    ir: {
      name,
      description,
      language,
      origin: 'code',
      code: fileContent,
      metadata: { source: 'code', fileName, ...(parseTimeframesFromText(fileContent).length ? { mtf: { timeframes: parseTimeframesFromText(fileContent) } } : {}), ...(parseIndicatorsFromText(fileContent).length ? { indicators: parseIndicatorsFromText(fileContent) } : {}), ...(Object.keys(parsePolicyFromText(fileContent)).length ? { policy: parsePolicyFromText(fileContent) } : {}), ...(parseSmcFromText(fileContent).length ? { smc: { features: parseSmcFromText(fileContent) } } : {}) },
    },
    notes: 'Compiled from code file',
  }
}
