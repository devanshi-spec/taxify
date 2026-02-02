import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
})

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
      select: { id: true, organizationId: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only OWNER and ADMIN can update team members
    if (!['OWNER', 'ADMIN'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const targetMember = await prisma.user.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    // Cannot modify OWNER
    if (targetMember.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot modify owner' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateMemberSchema.parse(body)

    const updatedMember = await prisma.user.update({
      where: { id },
      data: validatedData,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    })

    return NextResponse.json({ data: updatedMember })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating team member:', error)
    return NextResponse.json(
      { error: 'Failed to update team member' },
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
      select: { id: true, organizationId: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only OWNER and ADMIN can remove team members
    if (!['OWNER', 'ADMIN'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Cannot remove self
    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    const targetMember = await prisma.user.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    // Cannot remove OWNER
    if (targetMember.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 })
    }

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing team member:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}
