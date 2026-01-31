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
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const conversationId = searchParams.get('conversationId')
        const period = searchParams.get('period') || '7d'

        if (!conversationId) {
            return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
        }

        // Verify conversation belongs to user's organization
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                organizationId: dbUser.organizationId,
            },
            include: {
                contact: true,
                channel: true,
            },
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

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

        // Get all messages in conversation
        const allMessages = await prisma.message.findMany({
            where: {
                conversationId,
                createdAt: { gte: startDate },
            },
            orderBy: { createdAt: 'asc' },
        })

        // Calculate metrics
        const totalMessages = allMessages.length
        const inboundMessages = allMessages.filter(m => m.direction === 'INBOUND')
        const outboundMessages = allMessages.filter(m => m.direction === 'OUTBOUND')
        const aiMessages = allMessages.filter(m => m.isAiGenerated)

        // Calculate response times
        const responseTimes: number[] = []
        for (let i = 0; i < inboundMessages.length; i++) {
            const inbound = inboundMessages[i]
            // Find next outbound message after this inbound
            const nextOutbound = outboundMessages.find(
                m => m.createdAt > inbound.createdAt
            )
            if (nextOutbound) {
                const responseTime = nextOutbound.createdAt.getTime() - inbound.createdAt.getTime()
                responseTimes.push(Math.floor(responseTime / 1000)) // Convert to seconds
            }
        }

        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : null

        const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : null
        const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : null

        // Message distribution by hour
        const messagesByHour = Array.from({ length: 24 }, () => ({ hour: 0, count: 0 }))
        allMessages.forEach(msg => {
            const hour = msg.createdAt.getHours()
            messagesByHour[hour].hour = hour
            messagesByHour[hour].count++
        })

        // Message distribution by day
        const messagesByDay: Record<string, { date: string; inbound: number; outbound: number }> = {}
        allMessages.forEach(msg => {
            const dateKey = msg.createdAt.toISOString().split('T')[0]
            if (!messagesByDay[dateKey]) {
                messagesByDay[dateKey] = { date: dateKey, inbound: 0, outbound: 0 }
            }
            if (msg.direction === 'INBOUND') {
                messagesByDay[dateKey].inbound++
            } else {
                messagesByDay[dateKey].outbound++
            }
        })

        // Message types distribution
        const messageTypes: Record<string, number> = {}
        allMessages.forEach(msg => {
            messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1
        })

        // Calculate conversation duration
        const firstMessage = allMessages[0]
        const lastMessage = allMessages[allMessages.length - 1]
        const durationMs = lastMessage && firstMessage
            ? lastMessage.createdAt.getTime() - firstMessage.createdAt.getTime()
            : 0
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24))
        const durationHours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

        // Message status distribution
        const statusDistribution: Record<string, number> = {}
        outboundMessages.forEach(msg => {
            statusDistribution[msg.status] = (statusDistribution[msg.status] || 0) + 1
        })

        // Calculate engagement score (0-100)
        const engagementScore = calculateEngagementScore({
            totalMessages,
            inboundCount: inboundMessages.length,
            outboundCount: outboundMessages.length,
            avgResponseTime,
            durationDays,
        })

        return NextResponse.json({
            data: {
                conversation: {
                    id: conversation.id,
                    status: conversation.status,
                    priority: conversation.priority,
                    createdAt: conversation.createdAt,
                    lastMessageAt: conversation.lastMessageAt,
                    contact: {
                        name: conversation.contact.name,
                        phoneNumber: conversation.contact.phoneNumber,
                        stage: conversation.contact.stage,
                    },
                    channel: {
                        name: conversation.channel.name,
                        type: conversation.channel.connectionType,
                    },
                },
                metrics: {
                    totalMessages,
                    inboundMessages: inboundMessages.length,
                    outboundMessages: outboundMessages.length,
                    aiMessages: aiMessages.length,
                    aiPercentage: totalMessages > 0
                        ? Math.round((aiMessages.length / totalMessages) * 100)
                        : 0,
                    avgResponseTime,
                    avgResponseTimeFormatted: avgResponseTime
                        ? formatDuration(avgResponseTime)
                        : 'N/A',
                    minResponseTime,
                    maxResponseTime,
                    duration: {
                        days: durationDays,
                        hours: durationHours,
                        formatted: `${durationDays}d ${durationHours}h`,
                    },
                    engagementScore,
                },
                distribution: {
                    byHour: messagesByHour.filter(h => h.count > 0),
                    byDay: Object.values(messagesByDay).sort((a, b) =>
                        a.date.localeCompare(b.date)
                    ),
                    byType: Object.entries(messageTypes).map(([type, count]) => ({
                        type,
                        count,
                        percentage: Math.round((count / totalMessages) * 100),
                    })),
                    byStatus: Object.entries(statusDistribution).map(([status, count]) => ({
                        status,
                        count,
                        percentage: Math.round((count / outboundMessages.length) * 100),
                    })),
                },
                timeline: allMessages.slice(0, 50).map(msg => ({
                    id: msg.id,
                    type: msg.type,
                    direction: msg.direction,
                    content: msg.content?.slice(0, 100),
                    isAiGenerated: msg.isAiGenerated,
                    status: msg.status,
                    createdAt: msg.createdAt,
                })),
            },
        })
    } catch (error) {
        console.error('Error fetching conversation analytics:', error)
        return NextResponse.json(
            { error: 'Failed to fetch conversation analytics' },
            { status: 500 }
        )
    }
}

function calculateEngagementScore(params: {
    totalMessages: number
    inboundCount: number
    outboundCount: number
    avgResponseTime: number | null
    durationDays: number
}): number {
    const { totalMessages, inboundCount, outboundCount, avgResponseTime, durationDays } = params

    if (totalMessages === 0) return 0

    // Factors:
    // 1. Message volume (30 points)
    const volumeScore = Math.min((totalMessages / 50) * 30, 30)

    // 2. Balance between inbound/outbound (20 points)
    const ratio = inboundCount > 0 ? outboundCount / inboundCount : 0
    const balanceScore = ratio >= 0.5 && ratio <= 2 ? 20 : 10

    // 3. Response time (30 points) - faster is better
    let responseScore = 0
    if (avgResponseTime !== null) {
        if (avgResponseTime < 300) responseScore = 30 // < 5 min
        else if (avgResponseTime < 900) responseScore = 25 // < 15 min
        else if (avgResponseTime < 3600) responseScore = 20 // < 1 hour
        else if (avgResponseTime < 14400) responseScore = 15 // < 4 hours
        else responseScore = 10
    }

    // 4. Conversation longevity (20 points)
    const longevityScore = Math.min((durationDays / 7) * 20, 20)

    return Math.round(volumeScore + balanceScore + responseScore + longevityScore)
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
}
