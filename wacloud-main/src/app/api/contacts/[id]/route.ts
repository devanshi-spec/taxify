import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const updateContactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  tags: z.array(z.string()).optional(),
  segment: z.string().optional().nullable(),
  stage: z.enum(['NEW', 'LEAD', 'QUALIFIED', 'CUSTOMER', 'CHURNED']).optional(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  isOptedIn: z.boolean().optional(),
  assignedTo: z.string().optional().nullable(),
  leadScore: z.number().optional(),
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

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        channel: { select: { id: true, name: true, phoneNumber: true } },
        conversations: {
          take: 10,
          orderBy: { lastMessageAt: 'desc' },
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
            _count: { select: { messages: true } },
          },
        },
        deals: {
          orderBy: { createdAt: 'desc' },
          include: {
            pipeline: { select: { id: true, name: true, stages: true } },
            assignedUser: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            _count: { select: { activities: true } },
          },
        },
        activities: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            deal: { select: { id: true, title: true } },
            creator: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        _count: {
          select: {
            conversations: true,
            campaignContacts: true,
            deals: true,
            activities: true,
          }
        },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ data: contact })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
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

    // Check if contact exists and belongs to this organization
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateContactSchema.parse(body)

    const updateData: Prisma.ContactUpdateInput = {}

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.email !== undefined) updateData.email = validatedData.email
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags
    if (validatedData.segment !== undefined) updateData.segment = validatedData.segment
    if (validatedData.stage !== undefined) updateData.stage = validatedData.stage
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes
    if (validatedData.customFields !== undefined) {
      updateData.customFields = validatedData.customFields as Prisma.InputJsonValue
    }
    if (validatedData.assignedTo !== undefined) updateData.assignedTo = validatedData.assignedTo
    if (validatedData.leadScore !== undefined) updateData.leadScore = validatedData.leadScore

    if (validatedData.isOptedIn !== undefined) {
      updateData.isOptedIn = validatedData.isOptedIn
      if (validatedData.isOptedIn) {
        updateData.optedInAt = new Date()
        updateData.optedOutAt = null
      } else {
        updateData.optedOutAt = new Date()
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        channel: { select: { id: true, name: true, phoneNumber: true } },
      },
    })

    return NextResponse.json({ data: contact })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating contact:', error)
    return NextResponse.json(
      { error: 'Failed to update contact' },
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

    // Check if contact exists and belongs to this organization
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    await prisma.contact.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    )
  }
}
