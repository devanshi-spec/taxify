import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['BROADCAST', 'DRIP', 'TRIGGERED']),
  channelId: z.string(),
  targetSegment: z.string().optional(),
  targetTags: z.array(z.string()).optional(),
  targetFilters: z.record(z.string(), z.unknown()).optional(),
  messageType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE']),
  messageContent: z.string().optional(),
  templateId: z.string().optional(),
  templateParams: z.record(z.string(), z.unknown()).optional(),
  mediaUrl: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  messagesPerSecond: z.number().min(1).max(10).optional(),
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
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const channelId = searchParams.get('channelId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Prisma.CampaignWhereInput = {
      organizationId: dbUser.organizationId,
    }

    if (status) where.status = status as Prisma.EnumCampaignStatusFilter['equals']
    if (type) where.type = type as Prisma.EnumCampaignTypeFilter['equals']
    if (channelId) where.channelId = channelId

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          channel: { select: { id: true, name: true, phoneNumber: true } },
          _count: { select: { contacts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ])

    return NextResponse.json({
      data: campaigns,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
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
    const validatedData = createCampaignSchema.parse(body)

    // Check if channel belongs to this organization
    const channel = await prisma.channel.findFirst({
      where: {
        id: validatedData.channelId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        type: validatedData.type,
        channelId: validatedData.channelId,
        organizationId: dbUser.organizationId,
        createdBy: dbUser.id,
        targetSegment: validatedData.targetSegment,
        targetTags: validatedData.targetTags || [],
        targetFilters: validatedData.targetFilters as Prisma.InputJsonValue | undefined,
        messageType: validatedData.messageType,
        messageContent: validatedData.messageContent,
        templateId: validatedData.templateId,
        templateParams: validatedData.templateParams as Prisma.InputJsonValue | undefined,
        mediaUrl: validatedData.mediaUrl,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
        messagesPerSecond: validatedData.messagesPerSecond || 1,
      },
      include: {
        channel: { select: { id: true, name: true, phoneNumber: true } },
      },
    })

    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
