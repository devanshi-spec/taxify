import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { EvolutionApiClient } from '@/lib/evolution-api/client'
import { WhatsAppCloudApiClient } from '@/lib/evolution-api/whatsapp-cloud'

const sendMessageSchema = z.object({
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE', 'INTERACTIVE']),
  content: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
  mediaCaption: z.string().optional().nullable(),
  mediaMimeType: z.string().optional().nullable(),
  mediaFileName: z.string().optional().nullable(),
  templateId: z.string().optional(),
  templateParams: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // cursor for infinite scroll

    const where: Record<string, unknown> = { conversationId }
    if (before) {
      where.createdAt = { lt: new Date(before) }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Return in chronological order
    return NextResponse.json({
      data: messages.reverse(),
      hasMore: messages.length === limit,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = sendMessageSchema.parse(body)

    // Get the conversation with contact and channel
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true, channel: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Get sender info
    const sender = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, name: true, organizationId: true },
    })

    if (!sender) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check message limit before sending
    const { enforceLimit, incrementUsage } = await import('@/lib/limits')
    try {
      await enforceLimit(sender.organizationId, 'messages')
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Message limit exceeded' },
        { status: 403 }
      )
    }

    // Create the message in database
    const message = await prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        senderId: sender?.id || null,
        senderName: sender?.name,
        type: validatedData.type,
        content: validatedData.content || null,
        mediaUrl: validatedData.mediaUrl || null,
        mediaCaption: validatedData.mediaCaption || null,
        mediaMimeType: validatedData.mediaMimeType || null,
        mediaFileName: validatedData.mediaFileName || null,
        templateId: validatedData.templateId,
        templateParams: validatedData.templateParams as Prisma.InputJsonValue | undefined,
        status: 'PENDING',
        isAiGenerated: false,
      },
    })

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: validatedData.content?.slice(0, 100) || '[Media]',
        updatedAt: new Date(),
      },
    })

    // Send message via WhatsApp API
    const channel = conversation.channel
    const contact = conversation.contact

    try {
      let waMessageId: string | null = null

      if (channel.connectionType === 'EVOLUTION_API' && channel.evolutionInstance) {
        // Send via Evolution API
        const evolutionClient = new EvolutionApiClient({
          baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
          apiKey: channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
        })

        const phoneNumber = contact.phoneNumber.replace(/\D/g, '')

        if (validatedData.type === 'TEXT' && validatedData.content) {
          const response = await evolutionClient.sendText(channel.evolutionInstance, {
            number: phoneNumber,
            text: validatedData.content,
          })
          waMessageId = response.key?.id || null
        } else if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(validatedData.type) && validatedData.mediaUrl) {
          const mediaType = validatedData.type.toLowerCase() as 'image' | 'video' | 'audio' | 'document'
          const response = await evolutionClient.sendMedia(channel.evolutionInstance, {
            number: phoneNumber,
            mediatype: mediaType,
            mimetype: validatedData.mediaMimeType || `${mediaType}/*`,
            media: validatedData.mediaUrl,
            caption: validatedData.mediaCaption || undefined,
            fileName: validatedData.mediaFileName || undefined,
          })
          waMessageId = response.key?.id || null
        }

        // Update message with WhatsApp message ID
        if (waMessageId) {
          await prisma.message.update({
            where: { id: message.id },
            data: {
              waMessageId,
              status: 'SENT',
              sentAt: new Date(),
            },
          })
        }

      } else if (channel.connectionType === 'CLOUD_API' && channel.phoneNumberId) {
        // Send via WhatsApp Cloud API
        const settings = channel.settings as { accessToken?: string } | null
        const accessToken = settings?.accessToken || process.env.META_ACCESS_TOKEN

        if (accessToken) {
          const cloudClient = new WhatsAppCloudApiClient({
            accessToken,
            phoneNumberId: channel.phoneNumberId,
            businessAccountId: channel.wabaId || undefined,
          })

          const phoneNumber = contact.phoneNumber.replace(/\D/g, '')

          if (validatedData.type === 'TEXT' && validatedData.content) {
            const response = await cloudClient.sendText({
              to: phoneNumber,
              text: { body: validatedData.content },
            })
            waMessageId = response.messages?.[0]?.id || null
          } else if (validatedData.type === 'IMAGE' && validatedData.mediaUrl) {
            const response = await cloudClient.sendMedia({
              to: phoneNumber,
              type: 'image',
              image: { link: validatedData.mediaUrl, caption: validatedData.mediaCaption || undefined },
            })
            waMessageId = response.messages?.[0]?.id || null
          } else if (validatedData.type === 'VIDEO' && validatedData.mediaUrl) {
            const response = await cloudClient.sendMedia({
              to: phoneNumber,
              type: 'video',
              video: { link: validatedData.mediaUrl, caption: validatedData.mediaCaption || undefined },
            })
            waMessageId = response.messages?.[0]?.id || null
          } else if (validatedData.type === 'DOCUMENT' && validatedData.mediaUrl) {
            const response = await cloudClient.sendMedia({
              to: phoneNumber,
              type: 'document',
              document: {
                link: validatedData.mediaUrl,
                caption: validatedData.mediaCaption || undefined,
                filename: validatedData.mediaFileName || undefined,
              },
            })
            waMessageId = response.messages?.[0]?.id || null
          } else if (validatedData.type === 'AUDIO' && validatedData.mediaUrl) {
            const response = await cloudClient.sendMedia({
              to: phoneNumber,
              type: 'audio',
              audio: { link: validatedData.mediaUrl },
            })
            waMessageId = response.messages?.[0]?.id || null
          }

          // Update message with WhatsApp message ID
          if (waMessageId) {
            await prisma.message.update({
              where: { id: message.id },
              data: {
                waMessageId,
                status: 'SENT',
                sentAt: new Date(),
              },
            })
          }
        }
      } else {
        // No API configured, mark as sent for demo purposes
        console.log('[Messages] No WhatsApp API configured, simulating send')
        setTimeout(async () => {
          try {
            await prisma.message.update({
              where: { id: message.id },
              data: {
                status: 'SENT',
                sentAt: new Date(),
              },
            })
          } catch (e) {
            console.error('[Messages] Error updating message status:', e)
          }
        }, 500)
      }
    } catch (sendError) {
      console.error('[Messages] Error sending via WhatsApp API:', sendError)
      // Mark message as failed
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          errorMessage: sendError instanceof Error ? sendError.message : 'Failed to send message',
        },
      })
    }

    // Increment message usage counter
    await incrementUsage(sender.organizationId, 'messages', 1)

    return NextResponse.json({ data: message })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
