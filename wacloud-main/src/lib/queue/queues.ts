import { Queue } from 'bullmq'
import { getRedisConnection } from './redis'

// Queue names
export const QUEUE_NAMES = {
  CAMPAIGN: 'campaign-jobs',
  IMPORT: 'import-jobs',
  MESSAGE: 'message-jobs',
} as const

// Job types
export interface CampaignJobData {
  campaignId: string
  action: 'execute' | 'schedule' | 'resume'
  organizationId: string
}

export interface ImportJobData {
  importId: string
  organizationId: string
}

export interface MessageJobData {
  conversationId: string
  messageId: string
  type: 'send' | 'retry'
}

// Default job options
const defaultJobOptions = {
  removeOnComplete: 100,
  removeOnFail: 500,
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
}

// Queue instances (lazy initialized)
let campaignQueue: Queue<CampaignJobData> | null = null
let importQueue: Queue<ImportJobData> | null = null
let messageQueue: Queue<MessageJobData> | null = null

export function getCampaignQueue(): Queue<CampaignJobData> {
  if (!campaignQueue) {
    campaignQueue = new Queue<CampaignJobData>(QUEUE_NAMES.CAMPAIGN, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
  }
  return campaignQueue
}

export function getImportQueue(): Queue<ImportJobData> {
  if (!importQueue) {
    importQueue = new Queue<ImportJobData>(QUEUE_NAMES.IMPORT, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
  }
  return importQueue
}

export function getMessageQueue(): Queue<MessageJobData> {
  if (!messageQueue) {
    messageQueue = new Queue<MessageJobData>(QUEUE_NAMES.MESSAGE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 5, // More retries for messages
      },
    })
  }
  return messageQueue
}

// Helper to schedule a campaign
export async function scheduleCampaign(
  campaignId: string,
  organizationId: string,
  runAt: Date
): Promise<string> {
  const queue = getCampaignQueue()
  const delay = Math.max(0, runAt.getTime() - Date.now())

  const job = await queue.add(
    'execute',
    { campaignId, action: 'execute', organizationId },
    { delay, jobId: `campaign-${campaignId}` }
  )

  return job.id || ''
}

// Helper to start a campaign immediately
export async function startCampaignJob(
  campaignId: string,
  organizationId: string
): Promise<string> {
  const queue = getCampaignQueue()

  const job = await queue.add(
    'execute',
    { campaignId, action: 'execute', organizationId },
    { jobId: `campaign-${campaignId}` }
  )

  return job.id || ''
}

// Helper to queue a contact import
export async function queueContactImport(
  importId: string,
  organizationId: string
): Promise<string> {
  const queue = getImportQueue()

  const job = await queue.add(
    'process',
    { importId, organizationId },
    { jobId: `import-${importId}` }
  )

  return job.id || ''
}

// Get job status
export async function getCampaignJobStatus(campaignId: string) {
  const queue = getCampaignQueue()
  const job = await queue.getJob(`campaign-${campaignId}`)

  if (!job) return null

  const state = await job.getState()
  const progress = job.progress

  return {
    id: job.id,
    state,
    progress,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
  }
}
