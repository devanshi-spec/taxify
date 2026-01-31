import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isAiEnabled: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
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

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: dbUser.organizationId,
      },
      include: {
        contact: true,
        channel: { select: { id: true, name: true, phoneNumber: true } },
        _count: { select: { messages: true } },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ data: conversation })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
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

    // Check if conversation exists and belongs to organization
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateConversationSchema.parse(body)

    const updateData: Record<string, unknown> = {}

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
      // If marking as resolved or closed, set closedAt and closedBy
      if (validatedData.status === 'RESOLVED' || validatedData.status === 'CLOSED') {
        updateData.closedAt = new Date()
        updateData.closedBy = dbUser.id
      } else {
        updateData.closedAt = null
        updateData.closedBy = null
      }
    }
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority
    if (validatedData.assignedTo !== undefined) updateData.assignedTo = validatedData.assignedTo
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags
    if (validatedData.isAiEnabled !== undefined) updateData.isAiEnabled = validatedData.isAiEnabled

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        contact: true,
        channel: { select: { id: true, name: true, phoneNumber: true } },
      },
    })

    return NextResponse.json({ data: conversation })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
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

    // Only admins and owners can delete conversations
    if (dbUser.role !== 'ADMIN' && dbUser.role !== 'OWNER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if conversation exists and belongs to organization
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    await prisma.conversation.delete({
      where: { id: conversationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
