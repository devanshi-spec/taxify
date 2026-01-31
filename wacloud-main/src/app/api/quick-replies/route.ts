import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createQuickReplySchema = z.object({
  title: z.string().min(1).max(100),
  shortcut: z.string().min(1).max(50).regex(/^\/[a-z0-9_-]+$/i, 'Shortcut must start with / and contain only letters, numbers, underscores, or hyphens'),
  content: z.string().min(1).max(2000),
  category: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  isGlobal: z.boolean().optional(),
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
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {
      organizationId: dbUser.organizationId,
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { shortcut: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = category
    }

    const quickReplies = await prisma.quickReply.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { title: 'asc' },
      ],
    })

    // Get unique categories
    const categories = await prisma.quickReply.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { category: true },
      distinct: ['category'],
    })

    const uniqueCategories = categories
      .map((c) => c.category)
      .filter((c): c is string => c !== null)

    return NextResponse.json({
      data: quickReplies,
      categories: uniqueCategories,
    })
  } catch (error) {
    console.error('Error fetching quick replies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quick replies' },
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
    const validation = createQuickReplySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if shortcut already exists
    const existing = await prisma.quickReply.findUnique({
      where: {
        shortcut_organizationId: {
          shortcut: data.shortcut,
          organizationId: dbUser.organizationId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `Shortcut "${data.shortcut}" already exists` },
        { status: 400 }
      )
    }

    const quickReply = await prisma.quickReply.create({
      data: {
        title: data.title,
        shortcut: data.shortcut,
        content: data.content,
        category: data.category || null,
        tags: data.tags || [],
        isGlobal: data.isGlobal || false,
        createdBy: dbUser.id,
        organizationId: dbUser.organizationId,
      },
    })

    return NextResponse.json({ data: quickReply }, { status: 201 })
  } catch (error) {
    console.error('Error creating quick reply:', error)
    return NextResponse.json(
      { error: 'Failed to create quick reply' },
      { status: 500 }
    )
  }
}
