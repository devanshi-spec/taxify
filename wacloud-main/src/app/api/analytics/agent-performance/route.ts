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

        // Only admins/owners can view all agent performance
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

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
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                break
            default: // 7d
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        }

        // Get team members
        const teamMembers = await prisma.user.findMany({
            where: {
                organizationId: dbUser.organizationId,
                ...(agentId ? { id: agentId } : {}),
            },
            select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        })

        // Calculate metrics for each agent
        const agentMetrics = await Promise.all(
            teamMembers.map(async (member) => {
                // Get conversation stats
                const [
                    assignedConversations,
                    resolvedConversations,
                    messagesSent,
                    avgResponseTimeData,
                ] = await Promise.all([
                    // Conversations assigned in period
                    prisma.conversation.count({
                        where: {
                            organizationId: dbUser.organizationId,
                            assignedTo: member.id,
                            createdAt: { gte: startDate },
                        },
                    }),

                    // Conversations resolved
                    prisma.conversation.count({
                        where: {
                            organizationId: dbUser.organizationId,
                            assignedTo: member.id,
                            status: 'RESOLVED',
                            closedAt: { gte: startDate },
                        },
                    }),

                    // Messages sent
                    prisma.message.count({
                        where: {
                            conversation: { organizationId: dbUser.organizationId },
                            senderId: member.id,
                            direction: 'OUTBOUND',
                            createdAt: { gte: startDate },
                        },
                    }),

                    // Calculate average response time
                    calculateAvgResponseTime(dbUser.organizationId, member.id, startDate),
                ])

                const resolutionRate = assignedConversations > 0
                    ? Math.round((resolvedConversations / assignedConversations) * 100)
                    : 0

                return {
                    agent: {
                        id: member.id,
                        name: member.name || member.email,
                        email: member.email,
                        avatarUrl: member.avatarUrl,
                        role: member.role,
                    },
                    metrics: {
                        assignedConversations,
                        resolvedConversations,
                        resolutionRate,
                        messagesSent,
                        avgResponseTime: avgResponseTimeData.avgSeconds,
                        avgResponseTimeFormatted: formatSeconds(avgResponseTimeData.avgSeconds),
                        firstResponseTime: avgResponseTimeData.firstResponseSeconds,
                        firstResponseTimeFormatted: formatSeconds(avgResponseTimeData.firstResponseSeconds),
                    },
                }
            })
        )

        // Calculate team totals
        const teamTotals = {
            totalAssigned: agentMetrics.reduce((sum, a) => sum + a.metrics.assignedConversations, 0),
            totalResolved: agentMetrics.reduce((sum, a) => sum + a.metrics.resolvedConversations, 0),
            totalMessages: agentMetrics.reduce((sum, a) => sum + a.metrics.messagesSent, 0),
            avgResolutionRate: agentMetrics.length > 0
                ? Math.round(agentMetrics.reduce((sum, a) => sum + a.metrics.resolutionRate, 0) / agentMetrics.length)
                : 0,
        }

        // Get leaderboard (top performers)
        const leaderboard = [...agentMetrics]
            .sort((a, b) => b.metrics.resolvedConversations - a.metrics.resolvedConversations)
            .slice(0, 5)

        return NextResponse.json({
            data: {
                agents: agentMetrics,
                teamTotals,
                leaderboard,
                period,
            },
        })
    } catch (error) {
        console.error('Error fetching agent performance:', error)
        return NextResponse.json(
            { error: 'Failed to fetch agent performance' },
            { status: 500 }
        )
    }
}

async function calculateAvgResponseTime(
    organizationId: string,
    agentId: string,
    startDate: Date
): Promise<{ avgSeconds: number; firstResponseSeconds: number }> {
    try {
        // Get conversations assigned to agent
        const conversations = await prisma.conversation.findMany({
            where: {
                organizationId,
                assignedTo: agentId,
                createdAt: { gte: startDate },
            },
            select: { id: true, createdAt: true },
        })

        if (conversations.length === 0) {
            return { avgSeconds: 0, firstResponseSeconds: 0 }
        }

        let totalResponseTime = 0
        let totalFirstResponseTime = 0
        let responseCount = 0
        let firstResponseCount = 0

        for (const conv of conversations) {
            // Get first inbound message
            const firstInbound = await prisma.message.findFirst({
                where: {
                    conversationId: conv.id,
                    direction: 'INBOUND',
                },
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            })

            if (!firstInbound) continue

            // Get first outbound response after first inbound
            const firstResponse = await prisma.message.findFirst({
                where: {
                    conversationId: conv.id,
                    direction: 'OUTBOUND',
                    createdAt: { gt: firstInbound.createdAt },
                },
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            })

            if (firstResponse) {
                const responseTime = (firstResponse.createdAt.getTime() - firstInbound.createdAt.getTime()) / 1000
                totalFirstResponseTime += responseTime
                firstResponseCount++
            }
        }

        return {
            avgSeconds: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
            firstResponseSeconds: firstResponseCount > 0 ? Math.round(totalFirstResponseTime / firstResponseCount) : 0,
        }
    } catch (error) {
        console.error('Error calculating response time:', error)
        return { avgSeconds: 0, firstResponseSeconds: 0 }
    }
}

function formatSeconds(seconds: number): string {
    if (seconds === 0) return '-'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}
