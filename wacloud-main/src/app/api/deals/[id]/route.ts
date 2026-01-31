import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET - Get single deal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const deal = await prisma.deal.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            avatarUrl: true,
            stage: true,
            segment: true,
            tags: true,
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
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            assignedUser: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            creator: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({ data: deal })
  } catch (error) {
    console.error('Error fetching deal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deal' },
      { status: 500 }
    )
  }
}

// PUT - Update deal
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()

    const deal = await prisma.deal.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        pipeline: { select: { stages: true } },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const {
      title,
      value,
      currency,
      stage,
      probability,
      expectedCloseDate,
      assignedTo,
      closedReason,
    } = body

    // Track stage change for activity
    const stageChanged = stage && stage !== deal.stage

    // Get probability from stage if not provided
    let newProbability = probability
    if (stage && probability === undefined) {
      const stages = deal.pipeline.stages as Array<{ id: string; probability: number }>
      newProbability = stages.find((s) => s.id === stage)?.probability ?? deal.probability
    }

    // Check if deal is being closed (won or lost)
    const closingStages = ['closed', 'lost', 'won']
    const isClosing = stage && closingStages.includes(stage) && !closingStages.includes(deal.stage)

    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(value !== undefined && { value }),
        ...(currency && { currency }),
        ...(stage && { stage }),
        ...(newProbability !== undefined && { probability: newProbability }),
        ...(expectedCloseDate !== undefined && {
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(closedReason !== undefined && { closedReason }),
        ...(isClosing && { closedAt: new Date() }),
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
    })

    // Log stage change as activity
    if (stageChanged) {
      const stages = deal.pipeline.stages as Array<{ id: string; name: string }>
      const oldStageName = stages.find((s) => s.id === deal.stage)?.name || deal.stage
      const newStageName = stages.find((s) => s.id === stage)?.name || stage

      await prisma.activity.create({
        data: {
          type: 'NOTE',
          title: 'Stage changed',
          description: `Deal moved from "${oldStageName}" to "${newStageName}"`,
          dealId: id,
          contactId: deal.contactId,
          createdBy: dbUser.id,
          organizationId: dbUser.organizationId,
        },
      })

      // Publish DEAL_STAGE_CHANGED event
      try {
        const { publishEvent } = await import('@/lib/automation/event-bus')
        await publishEvent({
          type: 'DEAL_STAGE_CHANGED',
          organizationId: dbUser.organizationId,
          data: {
            dealId: id,
            contactId: deal.contactId,
            pipelineId: deal.pipelineId,
            newStageId: stage,
            oldStageId: deal.stage,
          },
        })
      } catch (err) {
        console.error('Failed to publish automation event:', err)
      }
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating deal:', error)
    return NextResponse.json(
      { error: 'Failed to update deal' },
      { status: 500 }
    )
  }
}

// DELETE - Delete deal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const deal = await prisma.deal.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Delete associated activities first
    await prisma.activity.deleteMany({
      where: { dealId: id },
    })

    // Delete deal
    await prisma.deal.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deal:', error)
    return NextResponse.json(
      { error: 'Failed to delete deal' },
      { status: 500 }
    )
  }
}
