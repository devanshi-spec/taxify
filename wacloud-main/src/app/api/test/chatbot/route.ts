import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getChatbotService } from '@/lib/services/chatbot-service'

/**
 * Test endpoint for chatbot - simulates an incoming message
 * POST /api/test/chatbot
 * Body: { conversationId: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, message } = body

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'conversationId and message are required' },
        { status: 400 }
      )
    }

    // Check conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true, channel: true },
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
        unreadCount: { increment: 1 },
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
        aiResponse: response ? {
          id: response.id,
          content: response.content,
          isAiGenerated: response.isAiGenerated,
        } : null,
        conversation: {
          id: conversation.id,
          isAiEnabled: conversation.isAiEnabled,
        },
      },
    })
  } catch (error) {
    console.error('Test chatbot error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check test setup
 */
export async function GET() {
  try {
    const chatbot = await prisma.chatbot.findFirst({
      where: { isActive: true },
    })

    const testConversation = await prisma.conversation.findFirst({
      where: { isAiEnabled: true },
      include: { contact: true, channel: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        chatbot: chatbot ? {
          id: chatbot.id,
          name: chatbot.name,
          isActive: chatbot.isActive,
          provider: chatbot.aiProvider,
          model: chatbot.aiModel,
          triggerKeywords: chatbot.triggerKeywords,
        } : null,
        testConversation: testConversation ? {
          id: testConversation.id,
          isAiEnabled: testConversation.isAiEnabled,
          contact: testConversation.contact.name,
          channel: testConversation.channel.name,
        } : null,
        instructions: {
          testEndpoint: 'POST /api/test/chatbot',
          body: {
            conversationId: testConversation?.id || 'your-conversation-id',
            message: 'I need to apply for leave tomorrow',
          },
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get test info' },
      { status: 500 }
    )
  }
}
