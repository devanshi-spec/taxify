import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { getChatbotService } from '@/lib/services/chatbot-service'

// Webhook event types from Evolution API
type WebhookEvent =
  | 'messages.upsert'
  | 'messages.update'
  | 'messages.delete'
  | 'send.message'
  | 'contacts.upsert'
  | 'contacts.update'
  | 'presence.update'
  | 'chats.upsert'
  | 'chats.update'
  | 'chats.delete'
  | 'groups.upsert'
  | 'groups.update'
  | 'group-participants.update'
  | 'connection.update'
  | 'call'
  | 'qrcode.updated'

interface WebhookPayload {
  event: WebhookEvent
  instance: string
  data: Record<string, unknown>
  destination: string
  date_time: string
  sender: string
  server_url: string
  apikey: string
}

interface MessageData {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
    participant?: string
  }
  pushName?: string
  message?: {
    conversation?: string
    extendedTextMessage?: { text: string }
    imageMessage?: { url: string; mimetype: string; caption?: string }
    videoMessage?: { url: string; mimetype: string; caption?: string }
    audioMessage?: { url: string; mimetype: string }
    documentMessage?: { url: string; mimetype: string; fileName: string }
    stickerMessage?: { url: string; mimetype: string }
    locationMessage?: { degreesLatitude: number; degreesLongitude: number; name?: string; address?: string }
    contactMessage?: { displayName: string; vcard: string }
    reactionMessage?: { key: { id: string }; text: string }
  }
  messageType: string
  messageTimestamp: number
  instanceId: string
  source: string
}

interface MessageStatusData {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  status: 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED'
  instanceId: string
}

interface ConnectionData {
  instance: string
  state: 'open' | 'close' | 'connecting'
  statusReason: number
}

interface QRCodeData {
  code?: string
  base64?: string
  pairingCode?: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (process.env.EVOLUTION_WEBHOOK_SECRET && webhookSecret !== process.env.EVOLUTION_WEBHOOK_SECRET) {
      console.warn('[Webhook] Invalid webhook secret - rejecting request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = (await request.json()) as WebhookPayload
    const { event, instance, data } = payload

    console.log(`[Webhook] Received event: ${event} for instance: ${instance}`)

    switch (event) {
      case 'messages.upsert':
        await handleMessageReceived(instance, data as unknown as MessageData)
        break

      case 'messages.update':
        await handleMessageStatusUpdate(instance, data as unknown as MessageStatusData)
        break

      case 'send.message':
        await handleMessageSent(instance, data as unknown as MessageData)
        break

      case 'connection.update':
        await handleConnectionUpdate(instance, data as unknown as ConnectionData)
        break

      case 'qrcode.updated':
        await handleQRCodeUpdate(instance, data as unknown as QRCodeData)
        break

      case 'presence.update':
        // Handle typing indicators, online status, etc.
        break

      default:
        console.log(`[Webhook] Unhandled event: ${event}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)
    // Return 200 to prevent retries
    return NextResponse.json({ success: false, error: 'Internal error' })
  }
}

async function handleMessageReceived(instance: string, data: MessageData) {
  try {
    console.log(`[Webhook] Message received from ${data.key.remoteJid}`)

    // Skip status broadcast messages and group messages for now
    if (data.key.remoteJid.endsWith('@broadcast') || data.key.remoteJid.endsWith('@g.us')) {
      console.log(`[Webhook] Skipping broadcast/group message`)
      return
    }

    // Find the channel by instance name
    const channel = await prisma.channel.findFirst({
      where: { evolutionInstance: instance },
      include: { organization: true },
    })

    if (!channel) {
      console.error(`[Webhook] Channel not found for instance: ${instance}`)
      return
    }

    // Extract phone number from JID
    const phoneNumber = data.key.remoteJid.split('@')[0]

    // Determine message type and content
    let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'CONTACT' | 'REACTION' | 'UNKNOWN' = 'TEXT'
    let content: string | null = null
    let mediaUrl: string | null = null
    let mediaMimeType: string | null = null
    let mediaCaption: string | null = null
    let mediaFileName: string | null = null
    let latitude: number | null = null
    let longitude: number | null = null
    let locationName: string | null = null
    let locationAddress: string | null = null
    let reaction: string | null = null
    let reactedTo: string | null = null

    if (data.message?.conversation) {
      content = data.message.conversation
    } else if (data.message?.extendedTextMessage) {
      content = data.message.extendedTextMessage.text
    } else if (data.message?.imageMessage) {
      messageType = 'IMAGE'
      mediaUrl = data.message.imageMessage.url
      mediaMimeType = data.message.imageMessage.mimetype
      mediaCaption = data.message.imageMessage.caption || null
    } else if (data.message?.videoMessage) {
      messageType = 'VIDEO'
      mediaUrl = data.message.videoMessage.url
      mediaMimeType = data.message.videoMessage.mimetype
      mediaCaption = data.message.videoMessage.caption || null
    } else if (data.message?.audioMessage) {
      messageType = 'AUDIO'
      mediaUrl = data.message.audioMessage.url
      mediaMimeType = data.message.audioMessage.mimetype
    } else if (data.message?.documentMessage) {
      messageType = 'DOCUMENT'
      mediaUrl = data.message.documentMessage.url
      mediaMimeType = data.message.documentMessage.mimetype
      mediaFileName = data.message.documentMessage.fileName
    } else if (data.message?.stickerMessage) {
      messageType = 'STICKER'
      mediaUrl = data.message.stickerMessage.url
      mediaMimeType = data.message.stickerMessage.mimetype
    } else if (data.message?.locationMessage) {
      messageType = 'LOCATION'
      latitude = data.message.locationMessage.degreesLatitude
      longitude = data.message.locationMessage.degreesLongitude
      locationName = data.message.locationMessage.name || null
      locationAddress = data.message.locationMessage.address || null
    } else if (data.message?.reactionMessage) {
      messageType = 'REACTION'
      reaction = data.message.reactionMessage.text
      reactedTo = data.message.reactionMessage.key.id
    }

    // Find or create contact
    let contact = await prisma.contact.findFirst({
      where: {
        phoneNumber,
        channelId: channel.id,
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          phoneNumber,
          name: data.pushName || null,
          profileName: data.pushName || null,
          waId: phoneNumber,
          channelId: channel.id,
          organizationId: channel.organizationId,
          stage: 'NEW',
          tags: [],
        },
      })
      console.log(`[Webhook] Created new contact: ${contact.id}`)
    } else if (data.pushName && !contact.name) {
      // Update contact name if we didn't have it
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: data.pushName, profileName: data.pushName },
      })
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
      console.log(`[Webhook] Created new conversation: ${conversation.id}`)
    }

    // Check for duplicate message
    const existingMessage = await prisma.message.findUnique({
      where: { waMessageId: data.key.id },
    })

    if (existingMessage) {
      console.log(`[Webhook] Message already exists: ${data.key.id}`)
      return
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        waMessageId: data.key.id,
        direction: data.key.fromMe ? 'OUTBOUND' : 'INBOUND',
        type: messageType,
        content,
        mediaUrl,
        mediaMimeType,
        mediaCaption,
        mediaFileName,
        latitude,
        longitude,
        locationName,
        locationAddress,
        reaction,
        reactedTo,
        status: data.key.fromMe ? 'SENT' : 'DELIVERED',
        sentAt: data.key.fromMe ? new Date(data.messageTimestamp * 1000) : null,
        deliveredAt: !data.key.fromMe ? new Date() : null,
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
        unreadCount: data.key.fromMe ? conversation.unreadCount : { increment: 1 },
        updatedAt: new Date(),
      },
    })

    // Update contact's last contacted time
    await prisma.contact.update({
      where: { id: contact.id },
      data: { lastContactedAt: new Date() },
    })

    console.log(`[Webhook] Saved ${messageType} message: ${message.id}`)

    // Trigger AI response if message is inbound and AI is enabled
    if (!data.key.fromMe && messageType === 'TEXT') {
      try {
        const chatbotService = getChatbotService()
        await chatbotService.processIncomingMessage(conversation.id, message)
      } catch (aiError) {
        console.error('[Webhook] Error processing AI response:', aiError)
      }
    }

  } catch (error) {
    console.error('[Webhook] Error handling message:', error)
  }
}

async function handleMessageStatusUpdate(instance: string, data: MessageStatusData) {
  try {
    console.log(`[Webhook] Message status update: ${data.key.id} -> ${data.status}`)

    // Map Evolution status to our status
    const statusMap: Record<string, 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
      PENDING: 'PENDING',
      SERVER_ACK: 'SENT',
      DELIVERY_ACK: 'DELIVERED',
      READ: 'READ',
      PLAYED: 'READ',
    }

    const status = statusMap[data.status]
    if (!status) {
      console.log(`[Webhook] Unknown status: ${data.status}`)
      return
    }

    // Find and update the message
    const message = await prisma.message.findUnique({
      where: { waMessageId: data.key.id },
    })

    if (!message) {
      console.log(`[Webhook] Message not found: ${data.key.id}`)
      return
    }

    const updateData: Prisma.MessageUpdateInput = {
      status,
      statusUpdatedAt: new Date(),
    }

    if (status === 'SENT') {
      updateData.sentAt = new Date()
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    } else if (status === 'READ') {
      updateData.readAt = new Date()
    }

    await prisma.message.update({
      where: { id: message.id },
      data: updateData,
    })

    console.log(`[Webhook] Updated message ${data.key.id} to status ${status}`)
  } catch (error) {
    console.error('[Webhook] Error updating message status:', error)
  }
}

async function handleMessageSent(instance: string, data: MessageData) {
  try {
    console.log(`[Webhook] Message sent confirmation: ${data.key.id}`)

    // Find and update the message
    const message = await prisma.message.findUnique({
      where: { waMessageId: data.key.id },
    })

    if (!message) {
      // Message might have been created with a temporary ID
      // Try to find by conversation and update
      console.log(`[Webhook] Sent message not found in DB: ${data.key.id}`)
      return
    }

    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        statusUpdatedAt: new Date(),
      },
    })

    console.log(`[Webhook] Confirmed message sent: ${message.id}`)
  } catch (error) {
    console.error('[Webhook] Error handling sent message:', error)
  }
}

async function handleConnectionUpdate(instance: string, data: ConnectionData) {
  try {
    console.log(`[Webhook] Connection update for ${instance}: ${data.state}`)

    // Map Evolution state to our channel status
    const statusMap: Record<string, 'CONNECTED' | 'DISCONNECTED' | 'PENDING' | 'ERROR'> = {
      open: 'CONNECTED',
      close: 'DISCONNECTED',
      connecting: 'PENDING',
    }

    const status = statusMap[data.state] || 'ERROR'

    // Update channel status
    const result = await prisma.channel.updateMany({
      where: { evolutionInstance: instance },
      data: { status },
    })

    if (result.count === 0) {
      console.warn(`[Webhook] No channel found for instance: ${instance}`)
      return
    }

    console.log(`[Webhook] Updated channel status to ${status}`)

    if (data.state === 'close') {
      console.warn(`[Webhook] Instance ${instance} disconnected. Reason: ${data.statusReason}`)
    }
  } catch (error) {
    console.error('[Webhook] Error updating connection status:', error)
  }
}

async function handleQRCodeUpdate(instance: string, data: QRCodeData) {
  try {
    console.log(`[Webhook] QR Code updated for ${instance}`)

    // Store QR code in channel settings for frontend to fetch
    if (data.base64 || data.code) {
      await prisma.channel.updateMany({
        where: { evolutionInstance: instance },
        data: {
          settings: {
            qrCode: data.base64 || null,
            qrCodeText: data.code || null,
            pairingCode: data.pairingCode || null,
            qrCodeUpdatedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      })
      console.log(`[Webhook] Stored QR code for instance ${instance}`)
    }
  } catch (error) {
    console.error('[Webhook] Error handling QR code update:', error)
  }
}

// GET handler for webhook verification (if needed)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // For Meta webhook verification
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ status: 'ok' })
}
