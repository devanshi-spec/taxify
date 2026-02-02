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
    const period = searchParams.get('period') || '7d'

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 48 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    }

    const organizationId = dbUser.organizationId

    // Get current period stats
    const [
      totalMessages,
      previousMessages,
      activeConversations,
      previousConversations,
      totalContacts,
      previousContacts,
      messagesByStatus,
      aiMessages,
      messagesByChannel,
      recentActivity,
      messageVolume,
    ] = await Promise.all([
      // Total messages in current period
      prisma.message.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: startDate },
        },
      }),

      // Total messages in previous period
      prisma.message.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: previousStartDate, lt: startDate },
        },
      }),

      // Active conversations
      prisma.conversation.count({
        where: {
          organizationId,
          status: { in: ['OPEN', 'PENDING'] },
          updatedAt: { gte: startDate },
        },
      }),

      // Previous active conversations
      prisma.conversation.count({
        where: {
          organizationId,
          status: { in: ['OPEN', 'PENDING'] },
          updatedAt: { gte: previousStartDate, lt: startDate },
        },
      }),

      // Total contacts
      prisma.contact.count({
        where: { organizationId },
      }),

      // Previous contacts
      prisma.contact.count({
        where: {
          organizationId,
          createdAt: { lt: startDate },
        },
      }),

      // Messages by status
      prisma.message.groupBy({
        by: ['status'],
        where: {
          conversation: { organizationId },
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // AI generated messages
      prisma.message.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: startDate },
          isAiGenerated: true,
        },
      }),

      // Messages by channel
      prisma.message.groupBy({
        by: ['conversationId'],
        where: {
          conversation: { organizationId },
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Recent activity
      prisma.message.findMany({
        where: {
          conversation: { organizationId },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          conversation: {
            include: {
              contact: { select: { name: true, phoneNumber: true } },
            },
          },
        },
      }),

      // Message volume by day
      getMessageVolumeByDay(organizationId, startDate, now),
    ])

    // Calculate percentages and changes
    const messagesChange = previousMessages > 0
      ? ((totalMessages - previousMessages) / previousMessages) * 100
      : 0

    const conversationsChange = previousConversations > 0
      ? ((activeConversations - previousConversations) / previousConversations) * 100
      : 0

    const newContacts = totalContacts - previousContacts
    const contactsChange = previousContacts > 0
      ? (newContacts / previousContacts) * 100
      : 0

    // Calculate delivery and read rates
    const deliveredCount = messagesByStatus.find(s => s.status === 'DELIVERED')?._count || 0
    const readCount = messagesByStatus.find(s => s.status === 'READ')?._count || 0
    const sentCount = messagesByStatus.find(s => s.status === 'SENT')?._count || 0
    const totalOutbound = deliveredCount + readCount + sentCount

    const deliveryRate = totalOutbound > 0
      ? ((deliveredCount + readCount) / totalOutbound) * 100
      : 0

    const readRate = totalOutbound > 0
      ? (readCount / totalOutbound) * 100
      : 0

    // AI response rate
    const aiResponseRate = totalMessages > 0
      ? (aiMessages / totalMessages) * 100
      : 0

    // Get top channels
    const topChannels = await getTopChannels(organizationId, startDate)

    // Format recent activity
    const formattedActivity = recentActivity.map(msg => ({
      type: msg.direction === 'INBOUND' ? 'message_received' : 'message_sent',
      text: msg.direction === 'INBOUND'
        ? `Message from ${msg.conversation.contact.name || msg.conversation.contact.phoneNumber}`
        : `Message sent to ${msg.conversation.contact.name || msg.conversation.contact.phoneNumber}`,
      preview: msg.content?.slice(0, 50) || `[${msg.type}]`,
      time: msg.createdAt,
    }))

    return NextResponse.json({
      data: {
        stats: {
          totalMessages,
          messagesChange: Math.round(messagesChange * 10) / 10,
          activeConversations,
          conversationsChange: Math.round(conversationsChange * 10) / 10,
          totalContacts,
          contactsChange: Math.round(contactsChange * 10) / 10,
          aiResponses: aiMessages,
          aiResponseRate: Math.round(aiResponseRate * 10) / 10,
          deliveryRate: Math.round(deliveryRate * 10) / 10,
          readRate: Math.round(readRate * 10) / 10,
        },
        topChannels,
        recentActivity: formattedActivity,
        messageVolume,
        period,
      },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

async function getTopChannels(organizationId: string, startDate: Date) {
  const channels = await prisma.channel.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: { conversations: true },
      },
    },
  })

  const channelStats = await Promise.all(
    channels.map(async channel => {
      const messageCount = await prisma.message.count({
        where: {
          conversation: {
            channelId: channel.id,
          },
          createdAt: { gte: startDate },
        },
      })

      return {
        id: channel.id,
        name: channel.name,
        messages: messageCount,
        conversations: channel._count.conversations,
        status: channel.status,
      }
    })
  )

  // Sort by messages and calculate percentages
  const sortedChannels = channelStats.sort((a, b) => b.messages - a.messages)
  const totalMessages = sortedChannels.reduce((sum, ch) => sum + ch.messages, 0)

  return sortedChannels.slice(0, 5).map(ch => ({
    ...ch,
    percentage: totalMessages > 0 ? Math.round((ch.messages / totalMessages) * 100) : 0,
  }))
}

async function getMessageVolumeByDay(organizationId: string, startDate: Date, endDate: Date) {
  const messages = await prisma.message.findMany({
    where: {
      conversation: { organizationId },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      createdAt: true,
      direction: true,
    },
  })

  // Group by day
  const volumeByDay: Record<string, { date: string; inbound: number; outbound: number }> = {}

  for (const msg of messages) {
    const dateKey = msg.createdAt.toISOString().split('T')[0]

    if (!volumeByDay[dateKey]) {
      volumeByDay[dateKey] = { date: dateKey, inbound: 0, outbound: 0 }
    }

    if (msg.direction === 'INBOUND') {
      volumeByDay[dateKey].inbound++
    } else {
      volumeByDay[dateKey].outbound++
    }
  }

  // Fill in missing days
  const result: { date: string; inbound: number; outbound: number }[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    result.push(volumeByDay[dateKey] || { date: dateKey, inbound: 0, outbound: 0 })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}
