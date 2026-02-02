import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const updateChatbotSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  aiProvider: z.enum(['openai', 'anthropic']).optional(),
  aiModel: z.string().optional(),
  systemPrompt: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  flowType: z.enum(['AI', 'FLOW', 'HYBRID']).optional(),
  flowData: z.record(z.string(), z.unknown()).optional().nullable(),
  triggerKeywords: z.array(z.string()).optional(),
  triggerOnNewConversation: z.boolean().optional(),
  handoffKeywords: z.array(z.string()).optional(),
  handoffMessage: z.string().optional().nullable(),
  respectBusinessHours: z.boolean().optional(),
  businessHours: z.record(z.string(), z.unknown()).optional().nullable(),
  outOfHoursMessage: z.string().optional().nullable(),
  knowledgeBase: z.record(z.string(), z.unknown()).optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    return NextResponse.json({ data: chatbot })
  } catch (error) {
    console.error('Error fetching chatbot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chatbot' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const existingChatbot = await prisma.chatbot.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingChatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateChatbotSchema.parse(body)

    const updateData: Prisma.ChatbotUpdateInput = {}

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
    if (validatedData.aiProvider !== undefined) updateData.aiProvider = validatedData.aiProvider
    if (validatedData.aiModel !== undefined) updateData.aiModel = validatedData.aiModel
    if (validatedData.systemPrompt !== undefined) updateData.systemPrompt = validatedData.systemPrompt
    if (validatedData.temperature !== undefined) updateData.temperature = validatedData.temperature
    if (validatedData.maxTokens !== undefined) updateData.maxTokens = validatedData.maxTokens
    if (validatedData.flowType !== undefined) updateData.flowType = validatedData.flowType
    if (validatedData.flowData !== undefined) {
      updateData.flowData = validatedData.flowData as Prisma.InputJsonValue
    }
    if (validatedData.triggerKeywords !== undefined) {
      updateData.triggerKeywords = validatedData.triggerKeywords
    }
    if (validatedData.triggerOnNewConversation !== undefined) {
      updateData.triggerOnNewConversation = validatedData.triggerOnNewConversation
    }
    if (validatedData.handoffKeywords !== undefined) {
      updateData.handoffKeywords = validatedData.handoffKeywords
    }
    if (validatedData.handoffMessage !== undefined) {
      updateData.handoffMessage = validatedData.handoffMessage
    }
    if (validatedData.respectBusinessHours !== undefined) {
      updateData.respectBusinessHours = validatedData.respectBusinessHours
    }
    if (validatedData.businessHours !== undefined) {
      updateData.businessHours = validatedData.businessHours as Prisma.InputJsonValue
    }
    if (validatedData.outOfHoursMessage !== undefined) {
      updateData.outOfHoursMessage = validatedData.outOfHoursMessage
    }
    if (validatedData.knowledgeBase !== undefined) {
      updateData.knowledgeBase = validatedData.knowledgeBase as Prisma.InputJsonValue
    }

    const chatbot = await prisma.chatbot.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: chatbot })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating chatbot:', error)
    return NextResponse.json(
      { error: 'Failed to update chatbot' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const existingChatbot = await prisma.chatbot.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingChatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    await prisma.chatbot.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chatbot:', error)
    return NextResponse.json(
      { error: 'Failed to delete chatbot' },
      { status: 500 }
    )
  }
}
