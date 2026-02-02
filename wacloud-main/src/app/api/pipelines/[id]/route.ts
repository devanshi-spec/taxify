import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET - Get single pipeline with deals
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

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        deals: {
          orderBy: { createdAt: 'desc' },
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
            _count: { select: { activities: true } },
          },
        },
      },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    return NextResponse.json({ data: pipeline })
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    )
  }
}

// PUT - Update pipeline
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
    const { name, stages, isDefault } = body

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.pipeline.updateMany({
        where: {
          organizationId: dbUser.organizationId,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.pipeline.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(stages && { stages }),
        ...(isDefault !== undefined && { isDefault }),
      },
      include: {
        _count: { select: { deals: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    )
  }
}

// DELETE - Delete pipeline
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

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
      include: {
        _count: { select: { deals: true } },
      },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    if (pipeline._count.deals > 0) {
      return NextResponse.json(
        { error: 'Cannot delete pipeline with existing deals' },
        { status: 400 }
      )
    }

    if (pipeline.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default pipeline' },
        { status: 400 }
      )
    }

    await prisma.pipeline.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    )
  }
}
