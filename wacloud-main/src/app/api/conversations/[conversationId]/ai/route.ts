import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getChatbotService } from '@/lib/services/chatbot-service'

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

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isAiEnabled: true, aiSessionId: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        isAiEnabled: conversation.isAiEnabled,
        aiSessionId: conversation.aiSessionId,
      },
    })
  } catch (error) {
    console.error('Error fetching AI status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI status' },
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
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled field must be a boolean' },
        { status: 400 }
      )
    }

    const chatbotService = getChatbotService()

    if (enabled) {
      await chatbotService.enableAI(conversationId)
    } else {
      await chatbotService.disableAI(conversationId)
    }

    return NextResponse.json({
      data: { isAiEnabled: enabled },
    })
  } catch (error) {
    console.error('Error toggling AI:', error)
    return NextResponse.json(
      { error: 'Failed to toggle AI' },
      { status: 500 }
    )
  }
}
