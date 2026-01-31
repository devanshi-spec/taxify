import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getAssignmentService } from '@/lib/services/assignment-service'

// POST - Assign conversation to agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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

    const { conversationId } = await params
    const body = await request.json()
    const { agentId, strategy } = body

    // Verify conversation belongs to organization
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
      },
      include: {
        channel: {
          select: { organizationId: true },
        },
      },
    })

    if (!conversation || conversation.channel.organizationId !== dbUser.organizationId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const assignmentService = getAssignmentService()

    if (agentId) {
      // Manual assignment
      // Verify agent is in organization
      const agentUser = await prisma.user.findFirst({
        where: {
          id: agentId,
          organizationId: dbUser.organizationId,
        },
      })

      if (!agentUser) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }

      await assignmentService.assignConversation(
        conversationId,
        agentId,
        dbUser.organizationId,
        'MANUAL',
        dbUser.id
      )

      return NextResponse.json({
        success: true,
        assignedTo: agentId,
      })
    } else if (strategy) {
      // Auto assignment
      const validStrategies = ['ROUND_ROBIN', 'LEAST_BUSY', 'SKILL_BASED']
      if (!validStrategies.includes(strategy)) {
        return NextResponse.json(
          { error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` },
          { status: 400 }
        )
      }

      const assignedAgentId = await assignmentService.autoAssign(conversationId, {
        strategy,
        organizationId: dbUser.organizationId,
        excludeAgentIds: conversation.assignedTo ? [conversation.assignedTo] : undefined,
      })

      if (!assignedAgentId) {
        return NextResponse.json(
          { error: 'No available agents for assignment' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        assignedTo: assignedAgentId,
      })
    } else {
      return NextResponse.json(
        { error: 'Either agentId or strategy is required' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error assigning conversation:', error)
    return NextResponse.json(
      { error: 'Failed to assign conversation' },
      { status: 500 }
    )
  }
}

// DELETE - Unassign conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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

    const { conversationId } = await params

    // Verify conversation
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId },
      include: {
        channel: { select: { organizationId: true } },
      },
    })

    if (!conversation || conversation.channel.organizationId !== dbUser.organizationId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const assignmentService = getAssignmentService()
    await assignmentService.unassignConversation(
      conversationId,
      dbUser.organizationId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unassigning conversation:', error)
    return NextResponse.json(
      { error: 'Failed to unassign conversation' },
      { status: 500 }
    )
  }
}
