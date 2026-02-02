import { NextRequest, NextResponse } from 'next/server'
import { ensureWorkersRunning } from '@/lib/queue'
import { getCampaignQueue, getImportQueue } from '@/lib/queue/queues'

// This endpoint ensures workers are running and returns queue stats
// Can be called by a cron job or health check

export async function GET(request: NextRequest) {
  try {
    // Verify secret for security (optional)
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.QUEUE_WORKER_SECRET

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure workers are running
    ensureWorkersRunning()

    // Get queue stats
    const campaignQueue = getCampaignQueue()
    const importQueue = getImportQueue()

    const [campaignStats, importStats] = await Promise.all([
      Promise.all([
        campaignQueue.getWaitingCount(),
        campaignQueue.getActiveCount(),
        campaignQueue.getCompletedCount(),
        campaignQueue.getFailedCount(),
      ]),
      Promise.all([
        importQueue.getWaitingCount(),
        importQueue.getActiveCount(),
        importQueue.getCompletedCount(),
        importQueue.getFailedCount(),
      ]),
    ])

    return NextResponse.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      queues: {
        campaigns: {
          waiting: campaignStats[0],
          active: campaignStats[1],
          completed: campaignStats[2],
          failed: campaignStats[3],
        },
        imports: {
          waiting: importStats[0],
          active: importStats[1],
          completed: importStats[2],
          failed: importStats[3],
        },
      },
    })
  } catch (error) {
    console.error('[QueueWorker] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get queue status', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST to manually trigger workers or process specific jobs
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.QUEUE_WORKER_SECRET

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { action } = body

    if (action === 'start') {
      ensureWorkersRunning()
      return NextResponse.json({ status: 'workers_started' })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[QueueWorker] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
