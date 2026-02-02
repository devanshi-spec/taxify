import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET - Get single activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            avatarUrl: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            stage: true,
          },
        },
      },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    return NextResponse.json({ data: activity })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}

// PUT - Update activity
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const { type, title, description, dueDate, assignedTo } = body

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(assignedTo !== undefined && { assignedTo }),
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
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}

// PATCH - Mark activity as complete
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        completedAt: activity.completedAt ? null : new Date(),
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
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error toggling activity completion:', error)
    return NextResponse.json(
      { error: 'Failed to toggle activity completion' },
      { status: 500 }
    )
  }
}

// DELETE - Delete activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    await prisma.activity.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting activity:', error)
    return NextResponse.json(
      { error: 'Failed to delete activity' },
      { status: 500 }
    )
  }
}
