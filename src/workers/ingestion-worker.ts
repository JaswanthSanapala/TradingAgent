import { compileStrategy } from '@lib/strategy/strategy-compiler'
import { Job,Worker } from 'bullmq'
import fs from 'fs/promises'

import { CONFIG } from '@/lib/config'
import { prisma } from '@/lib/db'
import { convertFileToText } from '@/lib/ingest/converters'
import { extractSpecFromText } from '@/lib/ingest/spec-extractor'
import { connection } from '@/lib/queue'

export type IngestionJobData = {
  name: string
  description?: string
  filePath: string
  originalName?: string
  mime?: string | null
  useOcr?: boolean
  useLLM?: boolean
}

export function startIngestionWorker() {
  if (!CONFIG.REDIS_ENABLED) return
  const worker = new Worker<IngestionJobData>(
    'ingestion',
    async (job: Job<IngestionJobData>) => {
      const { name, description, filePath, originalName, mime, useOcr, useLLM } = job.data
      const buffer = await fs.readFile(filePath)

      // Convert to text (OCR if requested)
      const converted = await convertFileToText({ buffer, fileName: originalName, mimeType: mime || null, options: { useOcr } })
      const textContent = converted.text

      // Extract spec (LLM reserved for future; use heuristic/system-md now)
      const extracted = await extractSpecFromText(textContent, { useLLM })

      // Compile IR
      const { ir, notes } = compileStrategy({ name, description, fileName: originalName || filePath, fileContent: textContent })

      // Ensure a default user exists
      let user = await prisma.user.findFirst()
      if (!user) {
        user = await prisma.user.create({ data: { email: 'default@trading.ai', name: 'Default User' } })
      }

      const strategy = await prisma.strategy.create({
        data: {
          name,
          description: description || '',
          userId: user.id,
          parameters: {
            fileName: originalName || filePath,
            fileType: converted.detected?.mime || 'text/plain',
            fileContent: textContent,
            compiled: ir as any,
            compilerNotes: notes,
            systemFormat: false,
            spec: extracted.spec as any,
            warnings: extracted.warnings as any,
            provenance: {
              detected: converted.detected,
              extraction: extracted.provenance,
              conversion: converted.provenance,
            } as any,
          },
        },
      })

      const agent = await prisma.agent.create({
        data: {
          name: `${name} Agent`,
          algorithm: 'ppo',
          version: 1,
          parameters: {
            lr: 3e-4,
            gamma: 0.99,
            strategyIR: ir,
            strategyOrigin: ir.origin,
          },
          performance: { progress: 0, status: 'untrained' },
          strategyId: strategy.id,
          userId: user.id,
        },
      })

      // Cleanup file
      try { await fs.unlink(filePath) } catch {}

      return { strategyId: strategy.id, agentId: agent.id }
    },
    { connection }
  )
  worker.on('failed', (job, err) => {
    console.error('[IngestionWorker] Job failed', job?.id, err)
  })
  return worker
}
