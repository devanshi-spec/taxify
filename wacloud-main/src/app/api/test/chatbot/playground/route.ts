import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getChatbotService } from '@/lib/services/chatbot-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, organizationId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, conversationId, message, chatbotId } = body

    if (action === 'create') {
      // Create or get test channel
      let testChannel = await prisma.channel.findFirst({
        where: {
          organizationId: dbUser.organizationId,
          name: 'Playground Test Channel',
        },
      })

      if (!testChannel) {
        testChannel = await prisma.channel.create({
          data: {
            name: 'Playground Test Channel',
            phoneNumber: '+0000000000',
            connectionType: 'EVOLUTION_API',
            status: 'CONNECTED',
            organizationId: dbUser.organizationId,
          },
        })
      }

      // Create test contact with unique identifier
      const testContact = await prisma.contact.create({
        data: {
          phoneNumber: `+test-${Date.now()}`,
          name: `Test User (${new Date().toLocaleString()})`,
          email: 'playground@test.local',
          channelId: testChannel.id,
          organizationId: dbUser.organizationId,
        },
      })

      // Create conversation with AI enabled and selected chatbot
      const conversation = await prisma.conversation.create({
        data: {
          contactId: testContact.id,
          channelId: testChannel.id,
          organizationId: dbUser.organizationId,
          status: 'OPEN',
          isAiEnabled: true,
          aiSessionId: chatbotId, // Store selected chatbot ID
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          conversationId: conversation.id,
          contactId: testContact.id,
          channelId: testChannel.id,
        },
      })
    }

    if (action === 'message') {
      if (!conversationId || !message) {
        return NextResponse.json(
          { error: 'conversationId and message are required' },
          { status: 400 }
        )
      }

      // Verify conversation belongs to user's org
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          organizationId: dbUser.organizationId,
        },
      })

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      // Create incoming message
      const incomingMessage = await prisma.message.create({
        data: {
          conversationId,
          direction: 'INBOUND',
          type: 'TEXT',
          content: message,
          status: 'DELIVERED',
        },
      })

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: message.slice(0, 100),
        },
      })

      // Process with chatbot
      const chatbotService = getChatbotService()
      const response = await chatbotService.processIncomingMessage(
        conversationId,
        incomingMessage
      )

      return NextResponse.json({
        success: true,
        data: {
          incomingMessage: {
            id: incomingMessage.id,
            content: incomingMessage.content,
          },
          aiResponse: response
            ? {
                id: response.id,
                content: response.content,
                isAiGenerated: response.isAiGenerated,
              }
            : null,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Playground error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    )
  }
}
