import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const createContactSchema = z.object({
  phoneNumber: z.string().min(10),
  name: z.string().optional(),
  email: z.string().email().optional(),
  channelId: z.string(),
  tags: z.array(z.string()).optional(),
  segment: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
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
    const search = searchParams.get('search')
    const channelId = searchParams.get('channelId')
    const stage = searchParams.get('stage')
    const segment = searchParams.get('segment')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const isOptedIn = searchParams.get('isOptedIn')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Prisma.ContactWhereInput = {
      organizationId: dbUser.organizationId,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (channelId) where.channelId = channelId
    if (stage) where.stage = stage as Prisma.EnumContactStageFilter['equals']
    if (segment) where.segment = segment
    if (isOptedIn !== null && isOptedIn !== undefined) {
      where.isOptedIn = isOptedIn === 'true'
    }
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          channel: { select: { id: true, name: true, phoneNumber: true } },
          _count: { select: { conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ])

    return NextResponse.json({
      data: contacts,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
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
      select: {
        id: true,
        organizationId: true,
        organization: { select: { plan: true, maxContacts: true } }
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ENFORCE LIMITS: Check contact count
    const currentCount = await prisma.contact.count({
      where: { organizationId: dbUser.organizationId }
    })

    // Limits based on Plan (or DB override)
    // You can hardcode defaults here or rely on the `maxContacts` field in DB if populated
    // The DB schema has `maxContacts` Int @default(500). Let's use that primarily.
    const limit = dbUser.organization.maxContacts || 500

    if (currentCount >= limit) {
      return NextResponse.json({
        error: `Plan limit reached (${limit} contacts). Please upgrade to add more contacts.`,
        code: 'LIMIT_REACHED'
      }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createContactSchema.parse(body)

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

    // Check if contact already exists for this phone number and channel
    const existingContact = await prisma.contact.findFirst({
      where: {
        phoneNumber: validatedData.phoneNumber,
        channelId: validatedData.channelId,
      },
    })

    if (existingContact) {
      return NextResponse.json(
        { error: 'Contact with this phone number already exists for this channel' },
        { status: 409 }
      )
    }

    const contact = await prisma.contact.create({
      data: {
        phoneNumber: validatedData.phoneNumber,
        name: validatedData.name,
        email: validatedData.email,
        channelId: validatedData.channelId,
        organizationId: dbUser.organizationId,
        tags: validatedData.tags || [],
        segment: validatedData.segment,
        notes: validatedData.notes,
        customFields: validatedData.customFields as Prisma.InputJsonValue | undefined,
      },
      include: {
        channel: { select: { id: true, name: true, phoneNumber: true } },
      },
    })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating contact:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}
