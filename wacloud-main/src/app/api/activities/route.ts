import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET - List activities
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
    const contactId = searchParams.get('contactId')
    const dealId = searchParams.get('dealId')
    const type = searchParams.get('type')
    const assignedTo = searchParams.get('assignedTo')
    const upcoming = searchParams.get('upcoming') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {
      organizationId: dbUser.organizationId,
    }

    if (contactId) where.contactId = contactId
    if (dealId) where.dealId = dealId
    if (type) where.type = type
    if (assignedTo) where.assignedTo = assignedTo
    if (upcoming) {
      where.completedAt = null
      where.dueDate = { gte: new Date() }
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: upcoming
          ? { dueDate: 'asc' }
          : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              avatarUrl: true,
            },
          },
          deal: {
            select: {
              id: true,
              title: true,
              value: true,
              currency: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
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
      }),
      prisma.activity.count({ where }),
    ])

    return NextResponse.json({
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST - Create activity
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
    const {
      type,
      title,
      description,
      dueDate,
      contactId,
      dealId,
      assignedTo,
    } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Type and title are required' },
        { status: 400 }
      )
    }

    const validTypes = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'WHATSAPP']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify contact if provided
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          organizationId: dbUser.organizationId,
        },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
    }

    // Verify deal if provided
    if (dealId) {
      const deal = await prisma.deal.findFirst({
        where: {
          id: dealId,
          organizationId: dbUser.organizationId,
        },
      })
      if (!deal) {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
      }
    }

    const activity = await prisma.activity.create({
      data: {
        type,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        contactId,
        dealId,
        assignedTo,
        createdBy: dbUser.id,
        organizationId: dbUser.organizationId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            avatarUrl: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
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
    })

    return NextResponse.json({ data: activity }, { status: 201 })
  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}
