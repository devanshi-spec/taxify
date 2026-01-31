import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '../redis'
import { QUEUE_NAMES, CampaignJobData } from '../queues'
import { prisma } from '@/lib/db'
import { EvolutionApiClient } from '@/lib/evolution-api/client'

// Campaign worker processor
async function processCampaignJob(job: Job<CampaignJobData>): Promise<void> {
  const { campaignId, action } = job.data

  console.log(`[CampaignWorker] Processing job ${job.id}: ${action} for campaign ${campaignId}`)

  if (action === 'execute') {
    await executeCampaign(campaignId, job)
  }
}

async function executeCampaign(campaignId: string, job: Job<CampaignJobData>): Promise<void> {
  // Get campaign with channel
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { channel: true },
  })

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`)
  }

  if (campaign.status !== 'SCHEDULED' && campaign.status !== 'DRAFT') {
    console.log(`[CampaignWorker] Campaign ${campaignId} is ${campaign.status}, skipping`)
    return
  }

  // Update campaign status to RUNNING
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  })

  // Get target contacts
  const contacts = await getTargetContacts(campaign)

  if (contacts.length === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalRecipients: 0,
      },
    })
    return
  }

  // Update total recipients
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalRecipients: contacts.length },
  })

  // Create CampaignContact records
  await prisma.campaignContact.createMany({
    data: contacts.map((contact) => ({
      campaignId,
      contactId: contact.id,
      status: 'PENDING',
    })),
    skipDuplicates: true,
  })

  // Initialize Evolution API client if needed
  let evolutionClient: EvolutionApiClient | null = null
  if (campaign.channel.connectionType === 'EVOLUTION_API' && campaign.channel.evolutionInstance) {
    evolutionClient = new EvolutionApiClient({
      baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: campaign.channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
    })
  }

  // Process contacts
  const delayMs = 1000 / (campaign.messagesPerSecond || 1)
  let sentCount = 0
  let failedCount = 0

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]

    // Check if campaign was paused/cancelled
    const currentCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    })

    if (currentCampaign?.status === 'PAUSED' || currentCampaign?.status === 'CANCELLED') {
      console.log(`[CampaignWorker] Campaign ${campaignId} was ${currentCampaign.status}, stopping`)
      break
    }

    try {
      // Send message
      const messageContent = personalizeMessage(campaign.messageContent || '', contact)

      if (evolutionClient && campaign.channel.evolutionInstance) {
        const phoneNumber = contact.phoneNumber.replace(/\D/g, '')
        await evolutionClient.sendText(campaign.channel.evolutionInstance, {
          number: phoneNumber,
          text: messageContent,
        })
      }

      // Update campaign contact status
      await prisma.campaignContact.update({
        where: {
          campaignId_contactId: {
            campaignId,
            contactId: contact.id,
          },
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      })

      sentCount++
    } catch (error) {
      console.error(`[CampaignWorker] Error sending to ${contact.phoneNumber}:`, error)

      await prisma.campaignContact.update({
        where: {
          campaignId_contactId: {
            campaignId,
            contactId: contact.id,
          },
        },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      failedCount++
    }

    // Update progress
    const progress = Math.round(((i + 1) / contacts.length) * 100)
    await job.updateProgress(progress)

    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount,
        failedCount,
      },
    })

    // Rate limiting delay
    if (i < contacts.length - 1) {
      await delay(delayMs)
    }
  }

  // Mark campaign as completed
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      sentCount,
      failedCount,
    },
  })

  console.log(`[CampaignWorker] Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`)
}

interface TargetContact {
  id: string
  phoneNumber: string
  name: string | null
  email: string | null
}

async function getTargetContacts(campaign: {
  organizationId: string
  channelId: string
  targetSegment: string | null
  targetTags: string[]
  targetFilters: unknown
}): Promise<TargetContact[]> {
  const where: Record<string, unknown> = {
    organizationId: campaign.organizationId,
    channelId: campaign.channelId,
    isOptedIn: true,
  }

  if (campaign.targetSegment) {
    where.segment = campaign.targetSegment
  }

  if (campaign.targetTags && campaign.targetTags.length > 0) {
    where.tags = { hasSome: campaign.targetTags }
  }

  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      email: true,
    },
  })

  return contacts
}

function personalizeMessage(
  template: string,
  contact: { name: string | null; email: string | null; phoneNumber: string }
): string {
  let message = template

  const firstName = contact.name?.split(' ')[0] || ''

  message = message.replace(/\{\{name\}\}/gi, contact.name || 'there')
  message = message.replace(/\{\{first_name\}\}/gi, firstName || 'there')
  message = message.replace(/\{\{phone\}\}/gi, contact.phoneNumber)
  message = message.replace(/\{\{email\}\}/gi, contact.email || '')

  return message
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Create worker instance
let worker: Worker<CampaignJobData> | null = null

export function startCampaignWorker(): Worker<CampaignJobData> {
  if (worker) {
    return worker
  }

  worker = new Worker<CampaignJobData>(
    QUEUE_NAMES.CAMPAIGN,
    processCampaignJob,
    {
      connection: getRedisConnection(),
      concurrency: 3,
    }
  )

  worker.on('completed', (job) => {
    console.log(`[CampaignWorker] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[CampaignWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[CampaignWorker] Worker error:', err.message)
  })

  console.log('[CampaignWorker] Worker started')

  return worker
}

export function stopCampaignWorker(): void {
  if (worker) {
    worker.close()
    worker = null
    console.log('[CampaignWorker] Worker stopped')
  }
}
