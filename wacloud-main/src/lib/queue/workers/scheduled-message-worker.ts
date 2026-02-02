import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '../redis'
import { prisma } from '@/lib/db'
import { EvolutionApiClient } from '@/lib/evolution-api/client'
import { createWhatsAppCloudClient } from '@/lib/evolution-api/whatsapp-cloud'
import type { Prisma } from '@prisma/client'

// Queue name
const SCHEDULED_MESSAGE_QUEUE = 'scheduled-messages'

// Job data type
interface ScheduledMessageJobData {
    conversationId: string
    contactId: string
    channelId: string
    organizationId: string
    createdBy: string
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'TEMPLATE'
    content?: string
    mediaUrl?: string
    mediaCaption?: string
    templateId?: string
    templateParams?: Record<string, string>
}

let scheduledMessageWorker: Worker<ScheduledMessageJobData> | null = null

/**
 * Process scheduled message job
 */
async function processScheduledMessage(job: Job<ScheduledMessageJobData>) {
    const {
        conversationId,
        contactId,
        channelId,
        organizationId,
        createdBy,
        type,
        content,
        mediaUrl,
        mediaCaption,
        templateId,
        templateParams
    } = job.data

    console.log(`[Scheduled Worker] Processing job ${job.id}: sending ${type} message`)

    try {
        // Get channel and contact info
        const [channel, contact] = await Promise.all([
            prisma.channel.findUnique({ where: { id: channelId } }),
            prisma.contact.findUnique({ where: { id: contactId } }),
        ])

        if (!channel || !contact) {
            throw new Error('Channel or contact not found')
        }

        // Create message record first
        const message = await prisma.message.create({
            data: {
                conversationId,
                direction: 'OUTBOUND',
                senderId: createdBy,
                type,
                content,
                mediaUrl,
                mediaCaption,
                templateId,
                templateParams: templateParams as Prisma.InputJsonValue,
                status: 'PENDING',
                isAiGenerated: false,
            },
        })

        // Send via appropriate API
        let waMessageId: string | null = null

        if (channel.connectionType === 'EVOLUTION_API' && channel.evolutionInstance) {
            waMessageId = await sendViaEvolutionApi(channel, contact.phoneNumber, job.data, message.id)
        } else if (channel.connectionType === 'CLOUD_API' && channel.phoneNumberId) {
            waMessageId = await sendViaCloudApi(channel, contact.phoneNumber, job.data, message.id)
        } else {
            throw new Error('Channel not properly configured for sending')
        }

        // Update message with WhatsApp ID
        await prisma.message.update({
            where: { id: message.id },
            data: {
                waMessageId,
                status: 'SENT',
                sentAt: new Date(),
                statusUpdatedAt: new Date(),
            },
        })

        // Update conversation
        const messagePreview = content?.slice(0, 100) || mediaCaption?.slice(0, 100) || `[${type}]`
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessageAt: new Date(),
                lastMessagePreview: messagePreview,
                updatedAt: new Date(),
            },
        })

        console.log(`[Scheduled Worker] Message sent successfully: ${message.id}`)
    } catch (error) {
        console.error(`[Scheduled Worker] Failed to send message:`, error)
        throw error
    }
}

/**
 * Send message via Evolution API
 */
async function sendViaEvolutionApi(
    channel: { evolutionInstance: string | null; evolutionApiKey: string | null },
    phoneNumber: string,
    data: ScheduledMessageJobData,
    messageId: string
): Promise<string | null> {
    if (!channel.evolutionInstance) {
        throw new Error('Evolution instance not configured')
    }

    const client = new EvolutionApiClient({
        baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
    })

    const formattedNumber = phoneNumber.replace(/\D/g, '')

    switch (data.type) {
        case 'TEXT':
            const textResponse = await client.sendText(channel.evolutionInstance, {
                number: formattedNumber,
                text: data.content || '',
            })
            return textResponse.key?.id || null

        case 'IMAGE':
        case 'VIDEO':
        case 'AUDIO':
        case 'DOCUMENT':
            const mediaResponse = await client.sendMedia(channel.evolutionInstance, {
                number: formattedNumber,
                mediatype: data.type.toLowerCase() as 'image' | 'video' | 'audio' | 'document',
                mimetype: 'application/octet-stream',
                media: data.mediaUrl || '',
                caption: data.mediaCaption,
            })
            return mediaResponse.key?.id || null

        case 'TEMPLATE':
            if (!data.templateId) throw new Error('Template ID required')
            const template = await prisma.messageTemplate.findUnique({
                where: { id: data.templateId },
            })
            if (!template) throw new Error('Template not found')

            const templateResponse = await client.sendTemplate(channel.evolutionInstance, {
                number: formattedNumber,
                name: template.name,
                language: template.language,
            })
            return templateResponse.key?.id || null

        default:
            throw new Error(`Unsupported message type: ${data.type}`)
    }
}

/**
 * Send message via WhatsApp Cloud API
 */
async function sendViaCloudApi(
    channel: { phoneNumberId: string | null; wabaId: string | null },
    phoneNumber: string,
    data: ScheduledMessageJobData,
    messageId: string
): Promise<string | null> {
    if (!channel.phoneNumberId) {
        throw new Error('Phone number ID not configured')
    }

    const client = createWhatsAppCloudClient({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
        phoneNumberId: channel.phoneNumberId,
        businessAccountId: channel.wabaId || undefined,
    })

    const formattedNumber = phoneNumber.replace(/\D/g, '')

    switch (data.type) {
        case 'TEXT':
            const textResponse = await client.sendText({
                to: formattedNumber,
                text: { body: data.content || '' },
            })
            return textResponse.messages?.[0]?.id || null

        case 'IMAGE':
            const imageResponse = await client.sendMedia({
                to: formattedNumber,
                type: 'image',
                image: { link: data.mediaUrl, caption: data.mediaCaption },
            })
            return imageResponse.messages?.[0]?.id || null

        case 'VIDEO':
            const videoResponse = await client.sendMedia({
                to: formattedNumber,
                type: 'video',
                video: { link: data.mediaUrl, caption: data.mediaCaption },
            })
            return videoResponse.messages?.[0]?.id || null

        case 'TEMPLATE':
            if (!data.templateId) throw new Error('Template ID required')
            const template = await prisma.messageTemplate.findUnique({
                where: { id: data.templateId },
            })
            if (!template) throw new Error('Template not found')

            const templateResponse = await client.sendTemplate({
                to: formattedNumber,
                template: {
                    name: template.name,
                    language: { code: template.language },
                },
            })
            return templateResponse.messages?.[0]?.id || null

        default:
            throw new Error(`Unsupported message type: ${data.type}`)
    }
}

/**
 * Start the scheduled message worker
 */
export function startScheduledMessageWorker(): void {
    if (scheduledMessageWorker) return

    scheduledMessageWorker = new Worker<ScheduledMessageJobData>(
        SCHEDULED_MESSAGE_QUEUE,
        processScheduledMessage,
        {
            connection: getRedisConnection(),
            concurrency: 5,
        }
    )

    scheduledMessageWorker.on('completed', (job) => {
        console.log(`[Scheduled Worker] Job ${job.id} completed`)
    })

    scheduledMessageWorker.on('failed', (job, err) => {
        console.error(`[Scheduled Worker] Job ${job?.id} failed:`, err.message)
    })

    console.log('[Scheduled Worker] Started')
}

/**
 * Stop the scheduled message worker
 */
export async function stopScheduledMessageWorker(): Promise<void> {
    if (scheduledMessageWorker) {
        await scheduledMessageWorker.close()
        scheduledMessageWorker = null
        console.log('[Scheduled Worker] Stopped')
    }
}
