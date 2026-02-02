import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  targetSegment: z.string().optional().nullable(),
  targetTags: z.array(z.string()).optional(),
  targetFilters: z.record(z.string(), z.unknown()).optional(),
  messageContent: z.string().optional(),
  templateId: z.string().optional().nullable(),
  templateParams: z.record(z.string(), z.unknown()).optional(),
  mediaUrl: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  messagesPerSecond: z.number().min(1).max(10).optional(),
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

    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        channel: { select: { id: true, name: true, phoneNumber: true } },
        contacts: {
          take: 100,
          include: {
            contact: {
              select: { id: true, name: true, phoneNumber: true },
            },
          },
        },
        _count: { select: { contacts: true } },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ data: campaign })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
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

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateCampaignSchema.parse(body)

    const updateData: Prisma.CampaignUpdateInput = {}

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
      if (validatedData.status === 'RUNNING' && !existingCampaign.startedAt) {
        updateData.startedAt = new Date()
      }
      if (validatedData.status === 'COMPLETED') {
        updateData.completedAt = new Date()
      }
    }
    if (validatedData.targetSegment !== undefined) updateData.targetSegment = validatedData.targetSegment
    if (validatedData.targetTags !== undefined) updateData.targetTags = validatedData.targetTags
    if (validatedData.targetFilters !== undefined) {
      updateData.targetFilters = validatedData.targetFilters as Prisma.InputJsonValue
    }
    if (validatedData.messageContent !== undefined) updateData.messageContent = validatedData.messageContent
    if (validatedData.templateId !== undefined) updateData.templateId = validatedData.templateId
    if (validatedData.templateParams !== undefined) {
      updateData.templateParams = validatedData.templateParams as Prisma.InputJsonValue
    }
    if (validatedData.mediaUrl !== undefined) updateData.mediaUrl = validatedData.mediaUrl
    if (validatedData.scheduledAt !== undefined) {
      updateData.scheduledAt = validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null
    }
    if (validatedData.messagesPerSecond !== undefined) {
      updateData.messagesPerSecond = validatedData.messagesPerSecond
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
      include: {
        channel: { select: { id: true, name: true, phoneNumber: true } },
      },
    })

    return NextResponse.json({ data: campaign })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
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

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Prevent deletion of running campaigns
    if (existingCampaign.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Cannot delete a running campaign. Please pause or cancel it first.' },
        { status: 400 }
      )
    }

    await prisma.campaign.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}
