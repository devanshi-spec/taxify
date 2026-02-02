// Queue exports
export * from './queues'
export * from './redis'
export * from './webhook-retry'

// Worker management for serverless
import { startCampaignWorker, stopCampaignWorker } from './workers/campaign-worker'
import { startImportWorker, stopImportWorker } from './workers/import-worker'
import { startAIWorker, stopAIWorker } from './workers/ai-worker'
import { startScheduledMessageWorker, stopScheduledMessageWorker } from './workers/scheduled-message-worker'
import { startWebhookRetryWorker, stopWebhookRetryWorker } from './webhook-retry'

let workersStarted = false

export function startAllWorkers(): void {
  if (workersStarted) return

  startCampaignWorker()
  startImportWorker()
  startAIWorker()
  startScheduledMessageWorker()
  startWebhookRetryWorker()
  workersStarted = true

  console.log('[Queue] All workers started')
}

export function stopAllWorkers(): void {
  stopCampaignWorker()
  stopImportWorker()
  stopAIWorker()
  stopScheduledMessageWorker()
  stopWebhookRetryWorker()
  workersStarted = false

  console.log('[Queue] All workers stopped')
}

// For serverless: Start workers on first request
export function ensureWorkersRunning(): void {
  if (!workersStarted) {
    startAllWorkers()
  }
}

