import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const updateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  phoneNumberId: z.string().optional().nullable(),
  wabaId: z.string().optional().nullable(),
  evolutionInstance: z.string().optional().nullable(),
  evolutionApiKey: z.string().optional().nullable(),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR']).optional(),
  webhookUrl: z.string().url().optional().nullable(),
  webhookSecret: z.string().optional().nullable(),
  businessProfile: z.record(z.string(), z.unknown()).optional().nullable(),
  settings: z.record(z.string(), z.unknown()).optional().nullable(),
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

    const channel = await prisma.channel.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        _count: {
          select: { contacts: true, conversations: true, campaigns: true, templates: true },
        },
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ data: channel })
  } catch (error) {
    console.error('Error fetching channel:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channel' },
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

    const existingChannel = await prisma.channel.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateChannelSchema.parse(body)

    const updateData: Prisma.ChannelUpdateInput = {}

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.phoneNumberId !== undefined) updateData.phoneNumberId = validatedData.phoneNumberId
    if (validatedData.wabaId !== undefined) updateData.wabaId = validatedData.wabaId
    if (validatedData.evolutionInstance !== undefined) updateData.evolutionInstance = validatedData.evolutionInstance
    if (validatedData.evolutionApiKey !== undefined) updateData.evolutionApiKey = validatedData.evolutionApiKey
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.webhookUrl !== undefined) updateData.webhookUrl = validatedData.webhookUrl
    if (validatedData.webhookSecret !== undefined) updateData.webhookSecret = validatedData.webhookSecret
    if (validatedData.businessProfile !== undefined) {
      updateData.businessProfile = validatedData.businessProfile as Prisma.InputJsonValue
    }
    if (validatedData.settings !== undefined) {
      updateData.settings = validatedData.settings as Prisma.InputJsonValue
    }

    const channel = await prisma.channel.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: channel })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating channel:', error)
    return NextResponse.json(
      { error: 'Failed to update channel' },
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

    const existingChannel = await prisma.channel.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    })

    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Warn if channel has active conversations
    if (existingChannel._count.conversations > 0) {
      const { searchParams } = new URL(request.url)
      const force = searchParams.get('force') === 'true'

      if (!force) {
        return NextResponse.json(
          {
            error: 'Channel has active conversations. Use ?force=true to delete anyway.',
            conversationCount: existingChannel._count.conversations,
          },
          { status: 400 }
        )
      }
    }

    await prisma.channel.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting channel:', error)
    return NextResponse.json(
      { error: 'Failed to delete channel' },
      { status: 500 }
    )
  }
}
