import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '../redis'
import { prisma } from '@/lib/db'
import { getChatbotService } from '@/lib/services/chatbot-service'

// AI Queue name
export const AI_QUEUE_NAME = 'ai-jobs'

// Job types
export interface AIJobData {
    type: 'chat_response' | 'summarize' | 'sentiment' | 'transcribe'
    conversationId: string
    messageId?: string
    organizationId: string
}

let aiWorker: Worker<AIJobData> | null = null

/**
 * Process AI jobs
 */
async function processAIJob(job: Job<AIJobData>) {
    const { type, conversationId, messageId, organizationId } = job.data

    console.log(`[AI Worker] Processing job ${job.id}: ${type} for conversation ${conversationId}`)

    try {
        switch (type) {
            case 'chat_response':
                await processAIChatResponse(conversationId, messageId)
                break
            case 'summarize':
                await processConversationSummary(conversationId)
                break
            case 'sentiment':
                await processsentimentAnalysis(conversationId, messageId)
                break
            case 'transcribe':
                if (messageId) await processTranscription(conversationId, messageId)
                break
            default:
                console.warn(`[AI Worker] Unknown job type: ${type}`)
        }

        console.log(`[AI Worker] Job ${job.id} completed successfully`)
    } catch (error) {
        console.error(`[AI Worker] Job ${job.id} failed:`, error)
        throw error
    }
}

/**
 * Generate AI chat response
 */
async function processAIChatResponse(conversationId: string, messageId?: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            contact: true,
            channel: true,
        },
    })

    if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`)
    }

    // Get the message to respond to
    let message = null
    if (messageId) {
        message = await prisma.message.findUnique({
            where: { id: messageId },
        })
    } else {
        // Get the latest inbound message
        message = await prisma.message.findFirst({
            where: {
                conversationId,
                direction: 'INBOUND',
            },
            orderBy: { createdAt: 'desc' },
        })
    }

    if (!message) {
        console.log('[AI Worker] No message to respond to')
        return
    }

    // Process with chatbot service
    const chatbotService = getChatbotService()
    await chatbotService.processIncomingMessage(conversationId, message)
}

/**
 * Generate conversation summary using AI
 */
async function processConversationSummary(conversationId: string) {
    const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 50,
    })

    if (messages.length < 3) {
        console.log('[AI Worker] Not enough messages for summary')
        return
    }

    // Build message history
    const messageText = messages
        .filter((m) => m.type === 'TEXT' && m.content)
        .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}: ${m.content}`)
        .join('\n')

    // Generate summary using AI provider
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
    })

    if (!conversation) return

    try {
        const { getAIManager } = await import('@/lib/ai/provider')
        const aiManager = getAIManager()

        const response = await aiManager.chat(
            [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that summarizes customer service conversations. Provide a concise 2-3 sentence summary highlighting key points, customer needs, and resolution status.',
                },
                {
                    role: 'user',
                    content: `Summarize this conversation:\n\n${messageText}`,
                },
            ],
            {
                provider: 'openai',
                model: 'gpt-4o-mini',
                temperature: 0.3,
                maxTokens: 150,
            },
            {
                organizationId: conversation.organizationId,
                feature: 'conversation-summary',
            }
        )

        // Store summary in conversation metadata or custom field
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                // You could add a summary field to the schema, or store in tags
                tags: [...(conversation.tags || []), `summary:${response.content.slice(0, 100)}`],
            },
        })

        console.log(`[AI Worker] Generated summary for conversation ${conversationId}`)
    } catch (error) {
        console.error('[AI Worker] Failed to generate summary:', error)
    }
}

/**
 * Analyze message sentiment
 */
async function processsentimentAnalysis(conversationId: string, messageId?: string) {
    const message = messageId
        ? await prisma.message.findUnique({ where: { id: messageId } })
        : await prisma.message.findFirst({
            where: { conversationId, direction: 'INBOUND' },
            orderBy: { createdAt: 'desc' },
        })

    if (!message || !message.content) {
        console.log('[AI Worker] No message content for sentiment analysis')
        return
    }

    // Implement sentiment analysis using AI provider
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { organizationId: true },
    })

    if (!conversation) return

    try {
        const { getAIManager } = await import('@/lib/ai/provider')
        const aiManager = getAIManager()

        const response = await aiManager.chat(
            [
                {
                    role: 'system',
                    content: 'You are a sentiment analysis expert. Analyze the sentiment of customer messages and respond with ONLY one word: POSITIVE, NEGATIVE, or NEUTRAL.',
                },
                {
                    role: 'user',
                    content: `Analyze the sentiment of this message: "${message.content}"`,
                },
            ],
            {
                provider: 'openai',
                model: 'gpt-4o-mini',
                temperature: 0.1,
                maxTokens: 10,
            },
            {
                organizationId: conversation.organizationId,
                feature: 'sentiment-analysis',
            }
        )

        const sentiment = response.content.trim().toUpperCase()
        console.log(`[AI Worker] Sentiment for message ${messageId}: ${sentiment}`)

        // Smart Routing Logic
        const updateData: any = {
            tags: {
                push: `SENTIMENT:${sentiment}`
            }
        }

        // If customer is angry, escalate immediately
        if (sentiment.includes('NEGATIVE')) {
            updateData.priority = 'URGENT'
            console.log(`[AI Worker] 🚨 Escalating conversation ${conversationId} to URGENT due to negative sentiment`)
        }
        // If customer is happy, mark as High priority (Sales Opportunity)
        else if (sentiment.includes('POSITIVE')) {
            updateData.priority = 'HIGH'
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData
        })
    } catch (error) {
        console.error('[AI Worker] Failed to analyze sentiment:', error)
    }
}

/**
 * Transcribe audio message
 */
async function processTranscription(conversationId: string, messageId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } })
    if (!message || !message.mediaUrl) {
        console.log('[AI Worker] No media to transcribe')
        return
    }

    try {
        console.log(`[AI Worker] Downloading audio from ${message.mediaUrl}`)
        const response = await fetch(message.mediaUrl)
        if (!response.ok) throw new Error('Failed to download audio')

        // Convert to blob-like for OpenAI
        const blob = await response.blob()
        // In Node, we might need to mock a File/Blob or use headers. 
        // OpenAI SDK usually accepts a Fetch Response or Blob.
        // We'll pass a constructed file object if possible, or the blob.

        const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' })

        const { createAIService } = await import('@/lib/ai/enhanced-provider')
        // Force OpenAI for transcription (Whisper)
        const service = createAIService('openai')

        const transcript = await service.transcribe(file)
        console.log(`[AI Worker] Transcription result: "${transcript.substring(0, 50)}..."`)

        if (transcript) {
            await prisma.message.update({
                where: { id: messageId },
                data: {
                    content: transcript,
                    // Optionally verify confidence or add metadata
                }
            })
        }
    } catch (error) {
        console.error('[AI Worker] Transcription failed:', error)
    }
}

/**
 * Start the AI worker
 */
export function startAIWorker(): void {
    if (aiWorker) return

    aiWorker = new Worker<AIJobData>(
        AI_QUEUE_NAME,
        processAIJob,
        {
            connection: getRedisConnection(),
            concurrency: 3,
            limiter: {
                max: 10,
                duration: 1000, // Max 10 jobs per second
            },
        }
    )

    aiWorker.on('completed', (job) => {
        console.log(`[AI Worker] Job ${job.id} completed`)
    })

    aiWorker.on('failed', (job, err) => {
        console.error(`[AI Worker] Job ${job?.id} failed:`, err.message)
    })

    console.log('[AI Worker] Started')
}

/**
 * Stop the AI worker
 */
export async function stopAIWorker(): Promise<void> {
    if (aiWorker) {
        await aiWorker.close()
        aiWorker = null
        console.log('[AI Worker] Stopped')
    }
}
