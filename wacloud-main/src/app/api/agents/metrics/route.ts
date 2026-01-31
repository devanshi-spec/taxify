import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
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

        // Only admins and owners can view all agent metrics
        const isAdmin = dbUser.role === 'OWNER' || dbUser.role === 'ADMIN'

        const { searchParams } = new URL(request.url)
        const period = searchParams.get('period') || '7d'
        const agentId = searchParams.get('agentId')

        // Calculate date range
        const now = new Date()
        let startDate: Date

        switch (period) {
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                break
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
            default: // 7d
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        }

        const organizationId = dbUser.organizationId

        // Get all agents or specific agent
        const agentFilter = agentId
            ? { id: agentId, organizationId }
            : { organizationId }

        // If not admin, only show own metrics
        const actualAgentFilter = isAdmin
            ? agentFilter
            : { id: dbUser.id, organizationId }

        const agents = await prisma.user.findMany({
            where: actualAgentFilter,
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
            },
        })

        // Get metrics for each agent
        const agentMetrics = await Promise.all(
            agents.map(async (agent) => {
                // Get conversation assignments
                const assignments = await prisma.conversationAssignment.findMany({
                    where: {
                        assignedTo: agent.id,
                        assignedAt: { gte: startDate },
                    },
                    include: {
                        conversation: true,
                    },
                })

                // Calculate metrics
                const totalAssignments = assignments.length
                const resolvedAssignments = assignments.filter(
                    (a) => a.conversation.status === 'RESOLVED' || a.conversation.status === 'CLOSED'
                ).length

                // Get response times
                const responseTimes = assignments
                    .filter((a) => a.firstResponseTime !== null)
                    .map((a) => a.firstResponseTime as number)

                const avgResponseTime = responseTimes.length > 0
                    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                    : null

                // Get resolution times
                const resolutionTimes = assignments
                    .filter((a) => a.resolutionTime !== null)
                    .map((a) => a.resolutionTime as number)

                const avgResolutionTime = resolutionTimes.length > 0
                    ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
                    : null

                // Get message counts
                const messageCount = await prisma.message.count({
                    where: {
                        direction: 'OUTBOUND',
                        senderId: agent.id,
                        createdAt: { gte: startDate },
                    },
                })

                // Get current workload
                const currentWorkload = await prisma.conversation.count({
                    where: {
                        assignedTo: agent.id,
                        status: { in: ['OPEN', 'PENDING'] },
                    },
                })

                // Get agent status
                const agentStatus = await prisma.agentStatus.findUnique({
                    where: { userId: agent.id },
                })

                // Calculate resolution rate
                const resolutionRate = totalAssignments > 0
                    ? Math.round((resolvedAssignments / totalAssignments) * 100)
                    : 0

                return {
                    agent: {
                        id: agent.id,
                        name: agent.name || agent.email,
                        email: agent.email,
                        avatarUrl: agent.avatarUrl,
                        status: agentStatus?.status || 'OFFLINE',
                    },
                    metrics: {
                        totalAssignments,
                        resolvedAssignments,
                        resolutionRate,
                        avgResponseTime, // in seconds
                        avgResponseTimeFormatted: avgResponseTime
                            ? formatDuration(avgResponseTime)
                            : 'N/A',
                        avgResolutionTime, // in seconds
                        avgResolutionTimeFormatted: avgResolutionTime
                            ? formatDuration(avgResolutionTime)
                            : 'N/A',
                        messagesSent: messageCount,
                        currentWorkload,
                        maxWorkload: agentStatus?.maxConcurrentChats || 5,
                    },
                }
            })
        )

        // Calculate team averages
        const teamMetrics = calculateTeamMetrics(agentMetrics)

        // Get leaderboard (top performers)
        const leaderboard = agentMetrics
            .sort((a, b) => b.metrics.resolvedAssignments - a.metrics.resolvedAssignments)
            .slice(0, 5)
            .map((am, index) => ({
                rank: index + 1,
                ...am,
            }))

        return NextResponse.json({
            data: {
                agents: agentMetrics,
                teamMetrics,
                leaderboard,
                period,
            },
        })
    } catch (error) {
        console.error('Error fetching agent metrics:', error)
        return NextResponse.json(
            { error: 'Failed to fetch agent metrics' },
            { status: 500 }
        )
    }
}

interface AgentMetric {
    agent: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
        status: string
    }
    metrics: {
        totalAssignments: number
        resolvedAssignments: number
        resolutionRate: number
        avgResponseTime: number | null
        avgResponseTimeFormatted: string
        avgResolutionTime: number | null
        avgResolutionTimeFormatted: string
        messagesSent: number
        currentWorkload: number
        maxWorkload: number
    }
}

function calculateTeamMetrics(agentMetrics: AgentMetric[]) {
    const totalAgents = agentMetrics.length
    if (totalAgents === 0) {
        return {
            totalAssignments: 0,
            totalResolved: 0,
            avgResolutionRate: 0,
            avgResponseTime: null,
            avgResponseTimeFormatted: 'N/A',
            totalMessagesSent: 0,
            activeAgents: 0,
        }
    }

    const totals = agentMetrics.reduce(
        (acc, am) => {
            return {
                totalAssignments: acc.totalAssignments + am.metrics.totalAssignments,
                resolvedAssignments: acc.resolvedAssignments + am.metrics.resolvedAssignments,
                responseTimes: am.metrics.avgResponseTime
                    ? [...acc.responseTimes, am.metrics.avgResponseTime]
                    : acc.responseTimes,
                messagesSent: acc.messagesSent + am.metrics.messagesSent,
            }
        },
        { totalAssignments: 0, resolvedAssignments: 0, responseTimes: [] as number[], messagesSent: 0 }
    )

    const avgResponseTime = totals.responseTimes.length > 0
        ? Math.round(totals.responseTimes.reduce((a, b) => a + b, 0) / totals.responseTimes.length)
        : null

    return {
        totalAssignments: totals.totalAssignments,
        totalResolved: totals.resolvedAssignments,
        avgResolutionRate: totals.totalAssignments > 0
            ? Math.round((totals.resolvedAssignments / totals.totalAssignments) * 100)
            : 0,
        avgResponseTime,
        avgResponseTimeFormatted: avgResponseTime ? formatDuration(avgResponseTime) : 'N/A',
        totalMessagesSent: totals.messagesSent,
        activeAgents: agentMetrics.filter((am) => am.agent.status === 'ONLINE').length,
    }
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
}
