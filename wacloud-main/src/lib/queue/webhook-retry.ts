import { Queue, Worker, Job } from 'bullmq'
import { getRedisConnection } from './redis'
import axios from 'axios'

// Queue name
const WEBHOOK_RETRY_QUEUE = 'webhook-retry'

// Job data type
export interface WebhookRetryJobData {
    webhookUrl: string
    payload: Record<string, unknown>
    headers?: Record<string, string>
    originalTimestamp: string
    retryCount: number
    maxRetries: number
    source: 'evolution' | 'cloud_api' | 'custom'
    referenceId?: string
}

let webhookRetryQueue: Queue<WebhookRetryJobData> | null = null
let webhookRetryWorker: Worker<WebhookRetryJobData> | null = null

/**
 * Get or create the webhook retry queue
 */
export function getWebhookRetryQueue(): Queue<WebhookRetryJobData> {
    if (!webhookRetryQueue) {
        webhookRetryQueue = new Queue<WebhookRetryJobData>(WEBHOOK_RETRY_QUEUE, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: 50,
                removeOnFail: 200,
            },
        })
    }
    return webhookRetryQueue
}

/**
 * Queue a failed webhook for retry
 */
export async function queueWebhookRetry(data: Omit<WebhookRetryJobData, 'retryCount' | 'maxRetries'> & { maxRetries?: number }): Promise<string | null> {
    const queue = getWebhookRetryQueue()

    const jobData: WebhookRetryJobData = {
        ...data,
        retryCount: 0,
        maxRetries: data.maxRetries || 5,
    }

    // Calculate delay based on exponential backoff
    const delay = calculateBackoffDelay(0)

    const job = await queue.add('retry-webhook', jobData, {
        delay,
        jobId: `webhook-retry-${data.referenceId || Date.now()}`,
    })

    console.log(`[Webhook Retry] Queued webhook for retry: ${job.id}`)
    return job.id || null
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(retryCount: number): number {
    // Base delay: 30 seconds, max: 30 minutes
    const baseDelay = 30 * 1000
    const maxDelay = 30 * 60 * 1000
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)

    // Add jitter (± 10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1)
    return Math.floor(delay + jitter)
}

/**
 * Process webhook retry job
 */
async function processWebhookRetry(job: Job<WebhookRetryJobData>): Promise<void> {
    const { webhookUrl, payload, headers, retryCount, maxRetries, source, referenceId } = job.data

    console.log(`[Webhook Retry] Processing retry ${retryCount + 1}/${maxRetries} for ${referenceId || webhookUrl}`)

    try {
        const response = await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Retry-Count': String(retryCount + 1),
                'X-Original-Timestamp': job.data.originalTimestamp,
                ...headers,
            },
            timeout: 30000, // 30 second timeout
            validateStatus: (status) => status >= 200 && status < 300,
        })

        console.log(`[Webhook Retry] Successfully delivered webhook: ${referenceId || webhookUrl}`)
    } catch (error) {
        const newRetryCount = retryCount + 1

        if (newRetryCount >= maxRetries) {
            console.error(`[Webhook Retry] Max retries reached for ${referenceId || webhookUrl}`)
            // Could store failed webhooks for manual review
            await storeFailedWebhook(job.data, error)
            throw new Error(`Max retries reached after ${maxRetries} attempts`)
        }

        // Queue for another retry
        const queue = getWebhookRetryQueue()
        const delay = calculateBackoffDelay(newRetryCount)

        await queue.add('retry-webhook', {
            ...job.data,
            retryCount: newRetryCount,
        }, {
            delay,
            jobId: `webhook-retry-${referenceId || Date.now()}-${newRetryCount}`,
        })

        console.log(`[Webhook Retry] Scheduled retry ${newRetryCount + 1} in ${delay / 1000}s`)
    }
}

/**
 * Store failed webhook for review
 */
async function storeFailedWebhook(data: WebhookRetryJobData, error: unknown): Promise<void> {
    // Store in Redis for later review
    const redis = getRedisConnection()
    const key = `failed-webhooks:${data.source}:${Date.now()}`

    await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify({
        ...data,
        error: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
    }))
}

/**
 * Get failed webhooks for review
 */
export async function getFailedWebhooks(source?: string): Promise<Array<WebhookRetryJobData & { error: string; failedAt: string }>> {
    const redis = getRedisConnection()
    const pattern = source ? `failed-webhooks:${source}:*` : 'failed-webhooks:*'

    const keys = await redis.keys(pattern)
    const webhooks: Array<WebhookRetryJobData & { error: string; failedAt: string }> = []

    for (const key of keys) {
        const data = await redis.get(key)
        if (data) {
            webhooks.push(JSON.parse(data))
        }
    }

    return webhooks.sort((a, b) =>
        new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime()
    )
}

/**
 * Retry a specific failed webhook manually
 */
export async function retryFailedWebhook(key: string): Promise<boolean> {
    const redis = getRedisConnection()
    const data = await redis.get(key)

    if (!data) return false

    const webhook = JSON.parse(data) as WebhookRetryJobData

    // Re-queue for retry
    await queueWebhookRetry({
        ...webhook,
        retryCount: 0,
    } as Omit<WebhookRetryJobData, 'retryCount' | 'maxRetries'>)

    // Remove from failed list
    await redis.del(key)

    return true
}

/**
 * Start the webhook retry worker
 */
export function startWebhookRetryWorker(): void {
    if (webhookRetryWorker) return

    webhookRetryWorker = new Worker<WebhookRetryJobData>(
        WEBHOOK_RETRY_QUEUE,
        processWebhookRetry,
        {
            connection: getRedisConnection(),
            concurrency: 3,
            limiter: {
                max: 10,
                duration: 1000, // Max 10 retries per second
            },
        }
    )

    webhookRetryWorker.on('completed', (job) => {
        console.log(`[Webhook Retry] Job ${job.id} completed`)
    })

    webhookRetryWorker.on('failed', (job, err) => {
        console.error(`[Webhook Retry] Job ${job?.id} failed:`, err.message)
    })

    console.log('[Webhook Retry Worker] Started')
}

/**
 * Stop the webhook retry worker
 */
export async function stopWebhookRetryWorker(): Promise<void> {
    if (webhookRetryWorker) {
        await webhookRetryWorker.close()
        webhookRetryWorker = null
        console.log('[Webhook Retry Worker] Stopped')
    }
}
