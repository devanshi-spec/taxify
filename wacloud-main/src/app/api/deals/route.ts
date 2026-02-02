import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createDealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  value: z.number().default(0),
  currency: z.string().default('USD'),
  stage: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  contactId: z.string().min(1, 'Contact ID is required'),
  pipelineId: z.string().min(1, 'Pipeline ID is required'),
  assignedTo: z.string().optional().nullable(),
})

// GET - List deals
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
    const pipelineId = searchParams.get('pipelineId')
    const stage = searchParams.get('stage')
    const contactId = searchParams.get('contactId')
    const assignedTo = searchParams.get('assignedTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {
      organizationId: dbUser.organizationId,
    }

    if (pipelineId) where.pipelineId = pipelineId
    if (stage) where.stage = stage
    if (contactId) where.contactId = contactId
    if (assignedTo) where.assignedTo = assignedTo

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
              avatarUrl: true,
            },
          },
          pipeline: {
            select: { id: true, name: true, stages: true },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
          _count: { select: { activities: true } },
        },
      }),
      prisma.deal.count({ where }),
    ])

    // Calculate pipeline value stats
    const stats = await prisma.deal.groupBy({
      by: ['stage'],
      where: { ...where, closedAt: null },
      _sum: { value: true },
      _count: true,
    })

    return NextResponse.json({
      data: deals,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}

// POST - Create deal
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

    // Zod Validation
    const validatedData = createDealSchema.parse(body)

    // Verify contact belongs to organization
    const contact = await prisma.contact.findFirst({
      where: {
        id: validatedData.contactId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Verify pipeline and get default stage
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: validatedData.pipelineId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    const stages = pipeline.stages as Array<{ id: string; name: string; probability: number }>
    const dealStage = validatedData.stage || stages[0]?.id
    const dealProbability = validatedData.probability ?? stages.find((s) => s.id === dealStage)?.probability ?? 0

    const deal = await prisma.deal.create({
      data: {
        title: validatedData.title,
        value: validatedData.value,
        currency: validatedData.currency,
        stage: dealStage,
        probability: dealProbability,
        expectedCloseDate: validatedData.expectedCloseDate ? new Date(validatedData.expectedCloseDate) : null,
        contactId: validatedData.contactId,
        pipelineId: validatedData.pipelineId,
        assignedTo: validatedData.assignedTo,
        organizationId: dbUser.organizationId,
        createdBy: dbUser.id,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            avatarUrl: true,
          },
        },
        pipeline: {
          select: { id: true, name: true, stages: true },
        },
        _count: { select: { activities: true } },
      },
    })

    // Create activity for deal creation
    await prisma.activity.create({
      data: {
        type: 'NOTE',
        title: 'Deal created',
        description: `Deal "${deal.title}" was created with value ${deal.currency} ${deal.value}`,
        contactId: deal.contactId,
        dealId: deal.id,
        createdBy: dbUser.id,
        organizationId: dbUser.organizationId,
      },
    })

    // Publish DEAL_CREATED event
    try {
      const { publishEvent } = await import('@/lib/automation/event-bus')
      await publishEvent({
        type: 'DEAL_STAGE_CHANGED', // Use stage changed for initial creation too, or specific created event
        organizationId: dbUser.organizationId,
        data: {
          dealId: deal.id,
          contactId: deal.contactId,
          pipelineId: deal.pipelineId,
          newStageId: deal.stage,
          oldStageId: null, // New deal
        },
      })
    } catch (err) {
      console.error('Failed to publish automation event:', err)
    }

    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 }
    )
  }
}
