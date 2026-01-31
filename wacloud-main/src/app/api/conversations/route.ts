import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, organizationId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const channelId = searchParams.get('channelId')
    const assignedTo = searchParams.get('assignedTo')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {
      organizationId: dbUser.organizationId,
    }

    if (status) where.status = status
    if (channelId) where.channelId = channelId
    if (assignedTo) where.assignedTo = assignedTo
    if (search) {
      where.OR = [
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { phoneNumber: { contains: search } } },
        { lastMessagePreview: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          channel: true,
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ])

    return NextResponse.json({
      data: conversations,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
