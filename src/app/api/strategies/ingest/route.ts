import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/core/db'
import { convertFileToText } from '@/lib/ingest/converters'
import { extractSpecFromText } from '@/lib/ingest/spec-extractor'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const name = (formData.get('name') as string) || ''
    const description = (formData.get('description') as string) || ''
    const file = formData.get('file') as File | null
    const editedContent = (formData.get('fileContent') as string) || ''
    const useOcr = ((formData.get('useOcr') as string) || 'false').toLowerCase() === 'true'
    const useLLM = ((formData.get('useLLM') as string) || 'true').toLowerCase() === 'true'

    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })

    let fileName: string | null = null
    let textContent: string | null = null
    let detected: { mime?: string | null; ext?: string | null } = {}
    const provenance: any = {}

    if (file) {
      fileName = file.name
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const mime = (file as any).type as string | undefined
      const converted = await convertFileToText({ buffer, fileName, mimeType: mime || null, options: { useOcr } })
      textContent = converted.text
      detected = converted.detected
      provenance.conversion = converted.provenance
    }

    // Allow ingestion from pasted/edited text as a fallback
    if (editedContent && editedContent.trim().length > 0) {
      textContent = editedContent
      if (!fileName) fileName = 'pasted.txt'
    }

    if (!textContent || !textContent.trim()) {
      return NextResponse.json({ success: false, error: 'No text could be extracted from the upload' }, { status: 400 })
    }

    // Extract StrategySpec (Phase 1: heuristic or system-md)
    const extracted = await extractSpecFromText(textContent, { useLLM })

    // Compile IR from the text directly (will extract code blocks if present)
    const compiled = (() => {
      try {
        return require('@lib/strategy/strategy-compiler') as any
      } catch {
        return null
      }
    })()

    const { compileStrategy } = compiled || (await import('@lib/strategy/strategy-compiler'))
    const { ir, notes } = compileStrategy({ name, description, fileName, fileContent: textContent })

    // Ensure a default user exists (no auth yet)
    let user = await prisma.user.findFirst()
    if (!user) {
      user = await prisma.user.create({ data: { email: 'default@trading.ai', name: 'Default User' } })
    }

    const strategy = await prisma.strategy.create({
      data: {
        name,
        description,
        userId: user.id,
        parameters: {
          fileName,
          fileType: detected?.mime || 'text/plain',
          fileContent: textContent,
          compiled: ir as unknown as Prisma.InputJsonValue,
          compilerNotes: notes,
          systemFormat: false,
          spec: extracted.spec as unknown as Prisma.InputJsonValue,
          warnings: extracted.warnings as unknown as Prisma.InputJsonValue,
          provenance: {
            detected,
            extraction: extracted.provenance,
            conversion: provenance.conversion,
            flags: { useOcr, useLLM },
          } as unknown as Prisma.InputJsonValue,
        },
      },
    })

    const createdAgent = await prisma.agent.create({
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

    return NextResponse.json({ success: true, strategy, agent: createdAgent })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Ingest failed' }, { status: 500 })
  }
}
