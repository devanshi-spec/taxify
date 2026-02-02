import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateQuickReplySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  shortcut: z.string().min(1).max(50).regex(/^\/[a-z0-9_-]+$/i, 'Shortcut must start with / and contain only letters, numbers, underscores, or hyphens').optional(),
  content: z.string().min(1).max(2000).optional(),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string()).optional(),
  isGlobal: z.boolean().optional(),
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

    const quickReply = await prisma.quickReply.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!quickReply) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 })
    }

    return NextResponse.json({ data: quickReply })
  } catch (error) {
    console.error('Error fetching quick reply:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quick reply' },
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

    const existing = await prisma.quickReply.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateQuickReplySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if new shortcut already exists (if shortcut is being changed)
    if (data.shortcut && data.shortcut !== existing.shortcut) {
      const duplicate = await prisma.quickReply.findUnique({
        where: {
          shortcut_organizationId: {
            shortcut: data.shortcut,
            organizationId: dbUser.organizationId,
          },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: `Shortcut "${data.shortcut}" already exists` },
          { status: 400 }
        )
      }
    }

    const quickReply = await prisma.quickReply.update({
      where: { id },
      data: {
        title: data.title,
        shortcut: data.shortcut,
        content: data.content,
        category: data.category,
        tags: data.tags,
        isGlobal: data.isGlobal,
      },
    })

    return NextResponse.json({ data: quickReply })
  } catch (error) {
    console.error('Error updating quick reply:', error)
    return NextResponse.json(
      { error: 'Failed to update quick reply' },
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

    const existing = await prisma.quickReply.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 })
    }

    await prisma.quickReply.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quick reply:', error)
    return NextResponse.json(
      { error: 'Failed to delete quick reply' },
      { status: 500 }
    )
  }
}

// Increment usage count when a quick reply is used
export async function PATCH(
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

    const quickReply = await prisma.quickReply.updateMany({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      data: {
        usageCount: { increment: 1 },
      },
    })

    if (quickReply.count === 0) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating quick reply usage:', error)
    return NextResponse.json(
      { error: 'Failed to update usage' },
      { status: 500 }
    )
  }
}
