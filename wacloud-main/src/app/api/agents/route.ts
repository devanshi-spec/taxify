import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET - List agents with status
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
    const status = searchParams.get('status')
    const includeMetrics = searchParams.get('includeMetrics') === 'true'

    // Get organization users
    const users = await prisma.user.findMany({
      where: { organizationId: dbUser.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    })

    // Get agent statuses
    const agentStatuses = await prisma.agentStatus.findMany({
      where: {
        organizationId: dbUser.organizationId,
        ...(status && { status: status as 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' }),
      },
    })

    // Map to status lookup
    const statusMap = new Map(
      agentStatuses.map((s) => [s.userId, s])
    )

    // Build agent list
    const agents = await Promise.all(
      users.map(async (orgUser) => {
        const agentStatus = statusMap.get(orgUser.id)

        let metrics = null
        if (includeMetrics) {
          // Get basic metrics
          const activeChats = await prisma.conversation.count({
            where: {
              assignedTo: orgUser.id,
              status: 'OPEN',
            },
          })

          const todayAssignments = await prisma.conversationAssignment.count({
            where: {
              assignedTo: orgUser.id,
              assignedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          })

          metrics = {
            activeChats,
            todayAssignments,
          }
        }

        return {
          id: orgUser.id,
          name: orgUser.name,
          email: orgUser.email,
          image: orgUser.avatarUrl,
          role: orgUser.role,
          status: agentStatus?.status || 'OFFLINE',
          maxConcurrentChats: agentStatus?.maxConcurrentChats || 5,
          currentLoad: agentStatus?.currentLoad || 0,
          skills: agentStatus?.skills || [],
          languages: agentStatus?.languages || [],
          lastActiveAt: agentStatus?.lastActiveAt,
          metrics,
        }
      })
    )

    // Filter by status if needed
    const filteredAgents = status
      ? agents.filter((a) => a.status === status)
      : agents

    // Sort: online first, then by load
    filteredAgents.sort((a, b) => {
      const statusOrder = { ONLINE: 0, AWAY: 1, BUSY: 2, OFFLINE: 3 }
      const statusDiff =
        (statusOrder[a.status as keyof typeof statusOrder] || 4) -
        (statusOrder[b.status as keyof typeof statusOrder] || 4)
      if (statusDiff !== 0) return statusDiff
      return a.currentLoad - b.currentLoad
    })

    return NextResponse.json({ data: filteredAgents })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}
