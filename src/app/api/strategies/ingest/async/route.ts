import { mkdir, writeFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

import { CONFIG } from '@/lib/config'
import { defaultJobOpts,queues } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!CONFIG.REDIS_ENABLED) {
      return NextResponse.json({ success: false, error: 'Redis is disabled. Set REDIS_ENABLED=true to use async ingestion.' }, { status: 400 })
    }

    const form = await request.formData()
    const name = (form.get('name') as string) || ''
    const description = (form.get('description') as string) || ''
    const file = form.get('file') as File | null
    const useOcr = ((form.get('useOcr') as string) || 'false').toLowerCase() === 'true'
    const useLLM = ((form.get('useLLM') as string) || 'true').toLowerCase() === 'true'

    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    if (!file) return NextResponse.json({ success: false, error: 'File is required for async ingestion' }, { status: 400 })

    // Persist upload to temp dir for worker to read
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadsDir = path.join(process.cwd(), 'uploads', 'ingestion')
    await mkdir(uploadsDir, { recursive: true })
    const fileName = `${Date.now()}_${file.name}`
    const filePath = path.join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    const job = await queues.ingestion.add('ingest', {
      name,
      description,
      filePath,
      originalName: file.name,
      mime: (file as any).type || null,
      useOcr,
      useLLM,
    }, defaultJobOpts)

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'enqueue failed' }, { status: 500 })
  }
}
