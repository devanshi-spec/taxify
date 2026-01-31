import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET - List templates
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
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    // Build where clause with channel's organizationId filter
    const where: Record<string, unknown> = {
      channel: {
        organizationId: dbUser.organizationId,
      },
    }

    if (channelId) where.channelId = channelId
    if (status) where.status = status
    if (category) where.category = category
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      }
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        channel: {
          select: { id: true, name: true },
        },
      },
    })

    // Get unique categories
    const categories = [...new Set(templates.map((t) => t.category))]

    // Get status counts
    const statusCounts = templates.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      data: templates,
      meta: {
        total: templates.length,
        categories,
        statusCounts,
      },
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST - Create template (submit to Meta for approval)
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
    const { channelId, name, language, category, components } = body

    if (!channelId || !name || !language || !category || !components) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get channel
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Extract body text from components
    const bodyText = components.find((c: { type: string }) => c.type === 'BODY')?.text || ''

    if (!bodyText) {
      return NextResponse.json(
        { error: 'Body text is required' },
        { status: 400 }
      )
    }

    // Create local record (Meta API integration can be added later)
    const template = await prisma.messageTemplate.create({
      data: {
        name: name.toLowerCase().replace(/\s+/g, '_'),
        language,
        category,
        status: 'DRAFT',
        bodyText,
        channelId,
      },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
