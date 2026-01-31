import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const createChatbotSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  aiProvider: z.enum(['openai', 'anthropic']).optional(),
  aiModel: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  flowType: z.enum(['AI', 'FLOW', 'HYBRID']).optional(),
  flowData: z.record(z.string(), z.unknown()).optional(),
  triggerKeywords: z.array(z.string()).optional(),
  triggerOnNewConversation: z.boolean().optional(),
  handoffKeywords: z.array(z.string()).optional(),
  handoffMessage: z.string().optional(),
  respectBusinessHours: z.boolean().optional(),
  businessHours: z.record(z.string(), z.unknown()).optional(),
  outOfHoursMessage: z.string().optional(),
  knowledgeBase: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const flowType = searchParams.get('flowType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Prisma.ChatbotWhereInput = {
      organizationId: dbUser.organizationId,
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }
    if (flowType) where.flowType = flowType as Prisma.EnumChatbotFlowTypeFilter['equals']

    const [chatbots, total] = await Promise.all([
      prisma.chatbot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatbot.count({ where }),
    ])

    return NextResponse.json({
      data: chatbots,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching chatbots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chatbots' },
      { status: 500 }
    )
  }
}

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
    const validatedData = createChatbotSchema.parse(body)

    const chatbot = await prisma.chatbot.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        organizationId: dbUser.organizationId,
        isActive: validatedData.isActive ?? false,
        aiProvider: validatedData.aiProvider || 'openai',
        aiModel: validatedData.aiModel || 'gpt-4o',
        systemPrompt: validatedData.systemPrompt,
        temperature: validatedData.temperature ?? 0.7,
        maxTokens: validatedData.maxTokens ?? 500,
        flowType: validatedData.flowType || 'AI',
        flowData: validatedData.flowData as Prisma.InputJsonValue | undefined,
        triggerKeywords: validatedData.triggerKeywords || [],
        triggerOnNewConversation: validatedData.triggerOnNewConversation ?? false,
        handoffKeywords: validatedData.handoffKeywords || [],
        handoffMessage: validatedData.handoffMessage,
        respectBusinessHours: validatedData.respectBusinessHours ?? false,
        businessHours: validatedData.businessHours as Prisma.InputJsonValue | undefined,
        outOfHoursMessage: validatedData.outOfHoursMessage,
        knowledgeBase: validatedData.knowledgeBase as Prisma.InputJsonValue | undefined,
      },
    })

    return NextResponse.json({ data: chatbot }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating chatbot:', error)
    return NextResponse.json(
      { error: 'Failed to create chatbot' },
      { status: 500 }
    )
  }
}
