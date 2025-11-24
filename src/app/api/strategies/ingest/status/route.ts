import { NextRequest, NextResponse } from 'next/server'

import { CONFIG } from '@/lib/config'
import { queues } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!CONFIG.REDIS_ENABLED) {
      return NextResponse.json({ success: false, error: 'Redis is disabled' }, { status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })

    const job = await queues.ingestion.getJob(jobId)
    if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })

    const state = await job.getState()
    const progress = job.progress
    const returnvalue = job.returnvalue
    const failedReason = job.failedReason

    return NextResponse.json({ success: true, state, progress, result: returnvalue, failedReason })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'status failed' }, { status: 500 })
  }
}
