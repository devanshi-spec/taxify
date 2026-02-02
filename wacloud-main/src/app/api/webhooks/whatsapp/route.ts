
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getChatbotService } from '@/lib/services/chatbot-service'
import type { Prisma } from '@prisma/client'

// =============================================
// WEBHOOK TYPES
// =============================================

interface WebhookEntry {
    id: string
    changes: Array<{
        value: {
            messaging_product: 'whatsapp'
            metadata: {
                display_phone_number: string
                phone_number_id: string
            }
            contacts?: Array<{
                profile: { name: string }
                wa_id: string
            }>
            messages?: Array<{
                from: string
                id: string
                timestamp: string
                type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'button' | 'reaction'
                text?: { body: string }
                image?: { id: string; caption?: string; mime_type: string; sha256: string }
                audio?: { id: string; mime_type: string }
                video?: { id: string; caption?: string; mime_type: string }
                document?: { id: string; caption?: string; filename: string; mime_type: string }
                sticker?: { id: string; mime_type: string }
                location?: { latitude: number; longitude: number; name?: string; address?: string }
                contacts?: Array<{ name: { formatted_name: string }; phones: Array<{ phone: string }> }>
                interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string; description?: string } }
                button?: { text: string; payload: string }
                reaction?: { message_id: string; emoji: string }
                context?: { from: string; id: string }
            }>
            statuses?: Array<{
                id: string
                status: 'sent' | 'delivered' | 'read' | 'failed'
                timestamp: string
                recipient_id: string
                errors?: Array<{ code: number; title: string; message?: string; error_data?: { details: string } }>
            }>
            errors?: Array<{ code: number; title: string; message?: string }>
        }
        field: string
    }>
}

interface InstagramMessagingEvent {
    sender: { id: string }
    recipient: { id: string }
    timestamp: number
    message?: {
        mid: string
        text?: string
        attachments?: Array<{ type: string; payload: { url: string } }>
        is_echo?: boolean
    }
}

interface InstagramEntry {
    id: string
    time: number
    messaging?: InstagramMessagingEvent[]
}

interface WebhookPayload {
    object: 'whatsapp_business_account' | 'instagram'
    entry: (WebhookEntry | InstagramEntry)[]
}

// =============================================
// WEBHOOK VERIFICATION (GET)
// =============================================

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Verify webhook
    if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
        console.log('[Meta Webhook] Verification successful')
        return new NextResponse(challenge, { status: 200 })
    }

    console.warn('[Meta Webhook] Verification failed - invalid token')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// =============================================
// WEBHOOK HANDLER (POST)
// =============================================

export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as WebhookPayload

        // Handle Instagram Webhook
        if (payload.object === 'instagram') {
            for (const entry of payload.entry as InstagramEntry[]) {
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        await handleInstagramEvent(entry.id, event)
                    }
                }
            }
            return NextResponse.json({ success: true })
        }

        // Handle WhatsApp Webhook
        if (payload.object === 'whatsapp_business_account') {
            for (const entry of payload.entry as WebhookEntry[]) {
                for (const change of entry.changes) {
                    if (change.field !== 'messages') continue

                    const { value } = change
                    const phoneNumberId = value.metadata.phone_number_id

                    // Handle incoming messages
                    if (value.messages) {
                        for (const message of value.messages) {
                            await handleIncomingMessage(phoneNumberId, message, value.contacts?.[0])
                        }
                    }

                    // Handle status updates
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            await handleStatusUpdate(phoneNumberId, status)
                        }
                    }
                }
            }
            return NextResponse.json({ success: true })
        }

        console.warn('[Meta Webhook] Unknown object type:', payload.object)
        return NextResponse.json({ success: true }) // Return 200 to acknowledge

    } catch (error) {
        console.error('[Meta Webhook] Error processing webhook:', error)
        return NextResponse.json({ success: true })
    }
}

// =============================================
// INSTAGRAM HANDLER
// =============================================

async function handleInstagramEvent(accountId: string, event: InstagramMessagingEvent) {
    // Skip echoes (messages sent by the page)
    if (event.message?.is_echo) return

    try {
        console.log(`[IG Webhook] Message from ${event.sender.id}`)

        // Find channel by Instagram ID
        const channel = await prisma.channel.findFirst({
            where: { instagramId: accountId },
            include: { organization: true }
        })

        if (!channel) {
            console.error(`[IG Webhook] Channel not found for Instagram ID: ${accountId}`)
            return
        }

        // Determine Message Type
        const senderId = event.sender.id
        let messageType: 'TEXT' | 'IMAGE' | 'UNKNOWN' = 'TEXT'
        let content = event.message?.text || null
        let mediaUrl: string | null = null

        if (event.message?.attachments && event.message.attachments.length > 0) {
            const attachment = event.message.attachments[0]
            if (attachment.type === 'image') {
                messageType = 'IMAGE'
                mediaUrl = attachment.payload.url
            } else {
                messageType = 'UNKNOWN'
            }
        }

        // Find/Create Contact
        let contact = await prisma.contact.findFirst({
            where: { phoneNumber: senderId, channelId: channel.id } // Reuse phoneNumber field for IG Sender ID
        })

        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    phoneNumber: senderId,
                    name: "Instagram User",
                    profileName: "Instagram User",
                    channelId: channel.id,
                    organizationId: channel.organizationId,
                    stage: 'NEW',
                    tags: ['instagram']
                }
            })
        }

        // Find/Create Conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                channelId: channel.id,
                status: { in: ['OPEN', 'PENDING'] }
            }
        })

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    channelId: channel.id,
                    organizationId: channel.organizationId,
                    status: 'OPEN',
                    unreadCount: 1,
                    tags: ['instagram']
                }
            })
        }

        // Create Message
        if (event.message?.mid) {
            const existing = await prisma.message.findUnique({ where: { waMessageId: event.message.mid } })
            if (existing) return

            const dbMessage = await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    waMessageId: event.message.mid,
                    direction: 'INBOUND',
                    type: messageType,
                    content,
                    mediaUrl,
                    status: 'DELIVERED',
                    deliveredAt: new Date(event.timestamp),
                    senderId: senderId
                }
            })

            // Trigger AI if Text
            if (messageType === 'TEXT') {
                // Reuse existing chatbot logic
                const chatbotService = getChatbotService()
                // Note: Logic might need to know it's Instagram to reply correctly
                // The chatbot service likely uses 'channel' info.
                await chatbotService.processIncomingMessage(conversation.id, dbMessage)
            }
        }

    } catch (e) {
        console.error('[IG Webhook] Error:', e)
    }
}

// =============================================
// WHATSAPP MESSAGE HANDLER (Existing)
// =============================================

async function handleIncomingMessage(
    phoneNumberId: string,
    message: NonNullable<WebhookEntry['changes'][0]['value']['messages']>[0],
    contactInfo?: { profile: { name: string }; wa_id: string }
) {
    try {
        console.log(`[Meta Webhook] Message received: ${message.id} from ${message.from}`)

        // Find channel by phone number ID
        const channel = await prisma.channel.findFirst({
            where: { phoneNumberId },
            include: { organization: true },
        })

        if (!channel) {
            console.error(`[Meta Webhook] Channel not found for phone number ID: ${phoneNumberId}`)
            return
        }

        const phoneNumber = message.from

        // Determine message type and content
        let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'CONTACT' | 'INTERACTIVE' | 'REACTION' | 'UNKNOWN' = 'UNKNOWN'
        let content: string | null = null
        let mediaUrl: string | null = null
        let mediaMimeType: string | null = null
        let mediaFileName: string | null = null
        let mediaCaption: string | null = null
        let latitude: number | null = null
        let longitude: number | null = null
        let locationName: string | null = null
        let locationAddress: string | null = null
        let reaction: string | null = null
        let reactedTo: string | null = null
        let interactiveType: string | null = null
        let interactiveData: Record<string, unknown> | null = null

        switch (message.type) {
            case 'text':
                messageType = 'TEXT'
                content = message.text?.body || null
                break
            case 'image':
                messageType = 'IMAGE'
                mediaMimeType = message.image?.mime_type || null
                mediaCaption = message.image?.caption || null
                // Media URL needs to be fetched via Graph API using message.image.id
                break
            case 'video':
                messageType = 'VIDEO'
                mediaMimeType = message.video?.mime_type || null
                mediaCaption = message.video?.caption || null
                break
            case 'audio':
                messageType = 'AUDIO'
                mediaMimeType = message.audio?.mime_type || null
                break
            case 'document':
                messageType = 'DOCUMENT'
                mediaMimeType = message.document?.mime_type || null
                mediaFileName = message.document?.filename || null
                mediaCaption = message.document?.caption || null
                break
            case 'sticker':
                messageType = 'STICKER'
                mediaMimeType = message.sticker?.mime_type || null
                break
            case 'location':
                messageType = 'LOCATION'
                latitude = message.location?.latitude || null
                longitude = message.location?.longitude || null
                locationName = message.location?.name || null
                locationAddress = message.location?.address || null
                break
            case 'interactive':
                messageType = 'INTERACTIVE'
                interactiveType = message.interactive?.type || null
                interactiveData = message.interactive as Record<string, unknown>
                content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || null
                break
            case 'button':
                messageType = 'INTERACTIVE'
                content = message.button?.text || null
                interactiveData = { payload: message.button?.payload }
                break
            case 'reaction':
                messageType = 'REACTION'
                reaction = message.reaction?.emoji || null
                reactedTo = message.reaction?.message_id || null
                break
        }

        // Find or create contact
        let contact = await prisma.contact.findFirst({
            where: { phoneNumber, channelId: channel.id },
        })

        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    phoneNumber,
                    name: contactInfo?.profile.name || null,
                    profileName: contactInfo?.profile.name || null,
                    waId: contactInfo?.wa_id || phoneNumber,
                    channelId: channel.id,
                    organizationId: channel.organizationId,
                    stage: 'NEW',
                    tags: [],
                },
            })
            console.log(`[Meta Webhook] Created new contact: ${contact.id}`)
        }

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                channelId: channel.id,
                status: { in: ['OPEN', 'PENDING'] },
            },
        })

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    channelId: channel.id,
                    organizationId: channel.organizationId,
                    status: 'OPEN',
                    priority: 'NORMAL',
                    unreadCount: 1,
                    tags: [],
                },
            })
            console.log(`[Meta Webhook] Created new conversation: ${conversation.id}`)
        }

        // Check for duplicate message
        const existingMessage = await prisma.message.findUnique({
            where: { waMessageId: message.id },
        })

        if (existingMessage) {
            console.log(`[Meta Webhook] Message already exists: ${message.id}`)
            return
        }

        // Create the message
        const dbMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                waMessageId: message.id,
                direction: 'INBOUND',
                type: messageType,
                content,
                mediaUrl,
                mediaMimeType,
                mediaFileName,
                mediaCaption,
                latitude,
                longitude,
                locationName,
                locationAddress,
                reaction,
                reactedTo,
                interactiveType,
                interactiveData: interactiveData as Prisma.InputJsonValue,
                status: 'DELIVERED',
                deliveredAt: new Date(),
                isAiGenerated: false,
            },
        })

        // Update conversation
        const messagePreview = content?.slice(0, 100) || mediaCaption?.slice(0, 100) || `[${messageType}]`
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                lastMessagePreview: messagePreview,
                unreadCount: { increment: 1 },
                updatedAt: new Date(),
            },
        })

        // Update contact
        await prisma.contact.update({
            where: { id: contact.id },
            data: { lastContactedAt: new Date() },
        })

        console.log(`[Meta Webhook] Saved ${messageType} message: ${dbMessage.id}`)

        // Trigger AI response for text messages
        if (messageType === 'TEXT') {
            try {
                const chatbotService = getChatbotService()
                await chatbotService.processIncomingMessage(conversation.id, dbMessage)
            } catch (aiError) {
                console.error('[Meta Webhook] Error processing AI response:', aiError)
            }
        }
    } catch (error) {
        console.error('[Meta Webhook] Error handling message:', error)
    }
}

// =============================================
// STATUS UPDATE HANDLER
// =============================================

async function handleStatusUpdate(
    phoneNumberId: string,
    status: NonNullable<WebhookEntry['changes'][0]['value']['statuses']>[0]
) {
    try {
        console.log(`[Meta Webhook] Status update: ${status.id} -> ${status.status}`)

        const statusMap: Record<string, 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
            sent: 'SENT',
            delivered: 'DELIVERED',
            read: 'READ',
            failed: 'FAILED',
        }

        const dbStatus = statusMap[status.status]
        if (!dbStatus) {
            console.log(`[Meta Webhook] Unknown status: ${status.status}`)
            return
        }

        const message = await prisma.message.findUnique({
            where: { waMessageId: status.id },
        })

        if (!message) {
            console.log(`[Meta Webhook] Message not found: ${status.id}`)
            return
        }

        const updateData: Prisma.MessageUpdateInput = {
            status: dbStatus,
            statusUpdatedAt: new Date(),
        }

        if (dbStatus === 'SENT') {
            updateData.sentAt = new Date(parseInt(status.timestamp) * 1000)
        } else if (dbStatus === 'DELIVERED') {
            updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000)
        } else if (dbStatus === 'READ') {
            updateData.readAt = new Date(parseInt(status.timestamp) * 1000)
        } else if (dbStatus === 'FAILED' && status.errors?.length) {
            updateData.errorCode = status.errors[0].code.toString()
            updateData.errorMessage = status.errors[0].message || status.errors[0].title
        }

        await prisma.message.update({
            where: { id: message.id },
            data: updateData,
        })

        console.log(`[Meta Webhook] Updated message ${status.id} to status ${dbStatus}`)
    } catch (error) {
        console.error('[Meta Webhook] Error handling status update:', error)
    }
}
