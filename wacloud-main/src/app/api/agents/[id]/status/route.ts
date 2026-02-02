import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssignmentService } from '@/lib/services/assignment-service'
import { prisma } from '@/lib/db'

// PUT - Update agent status
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
      select: { id: true, organizationId: true, role: true },
    })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, maxConcurrentChats, skills, languages } = body

    // Verify user is in organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Check if user can update (only self or admin)
    const isAdmin = dbUser.role === 'OWNER' || dbUser.role === 'ADMIN'
    const isSelf = id === dbUser.id

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update agent status
    const agentStatus = await prisma.agentStatus.upsert({
      where: { userId: id },
      update: {
        ...(status && { status }),
        ...(maxConcurrentChats !== undefined && { maxConcurrentChats }),
        ...(skills && { skills: skills.map((s: string) => s.toLowerCase()) }),
        ...(languages && { languages: languages.map((l: string) => l.toLowerCase()) }),
        lastActiveAt: new Date(),
      },
      create: {
        userId: id,
        organizationId: dbUser.organizationId,
        status: status || 'OFFLINE',
        maxConcurrentChats: maxConcurrentChats || 5,
        skills: skills?.map((s: string) => s.toLowerCase()) || [],
        languages: languages?.map((l: string) => l.toLowerCase()) || [],
      },
    })

    return NextResponse.json({ data: agentStatus })
  } catch (error) {
    console.error('Error updating agent status:', error)
    return NextResponse.json(
      { error: 'Failed to update agent status' },
      { status: 500 }
    )
  }
}

// GET - Get agent status
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

    const agentStatus = await prisma.agentStatus.findFirst({
      where: {
        userId: id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!agentStatus) {
      return NextResponse.json({
        data: {
          userId: id,
          status: 'OFFLINE',
          maxConcurrentChats: 5,
          currentLoad: 0,
          skills: [],
          languages: [],
        },
      })
    }

    // Include metrics
    const assignmentService = getAssignmentService()
    const metrics = await assignmentService.getAgentMetrics(
      id,
      dbUser.organizationId
    )

    return NextResponse.json({
      data: {
        ...agentStatus,
        metrics,
      },
    })
  } catch (error) {
    console.error('Error fetching agent status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent status' },
      { status: 500 }
    )
  }
}
