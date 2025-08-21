export type StrategyIR = {
  name?: string
  description?: string
  language: 'md' | 'ts' | 'js' | 'py' | 'txt'
  origin: 'markdown' | 'code'
  code?: string
  rules?: string[]
  metadata?: Record<string, any>
}

function detectLanguage(fileName?: string | null, content?: string | null): StrategyIR['language'] {
  const lower = (fileName || '').toLowerCase()
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'ts'
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'js'
  if (lower.endsWith('.py')) return 'py'
  if (lower.endsWith('.md') || /(^|\n)#+\s/.test(content || '')) return 'md'
  return 'txt'
}

function extractFirstCodeBlock(md: string): { lang?: string; code?: string } {
  const codeBlock = md.match(/```(\w+)?\n([\s\S]*?)```/)
  if (!codeBlock) return {}
  const [, lang, code] = codeBlock
  return { lang, code }
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
    const { lang, code } = extractFirstCodeBlock(fileContent)
    const rules = extractRulesFromMarkdown(fileContent)
    const origin: StrategyIR['origin'] = code ? 'code' : 'markdown'
    const inferredLang: StrategyIR['language'] = (lang as any) || 'md'

    return {
      ir: {
        name,
        description,
        language: inferredLang as StrategyIR['language'],
        origin,
        code: code || undefined,
        rules: rules.length ? rules : undefined,
        metadata: { source: 'markdown', fileName },
      },
      notes: code ? 'Extracted first code block from markdown' : 'No code block found; using rules-only IR',
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
      metadata: { source: 'code', fileName },
    },
    notes: 'Compiled from code file',
  }
}
