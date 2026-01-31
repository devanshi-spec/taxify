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
        const query = searchParams.get('q') || ''
        const conversationId = searchParams.get('conversationId')
        const type = searchParams.get('type') // TEXT, IMAGE, etc.
        const direction = searchParams.get('direction') // INBOUND, OUTBOUND
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

        if (!query && !conversationId) {
            return NextResponse.json(
                { error: 'Search query or conversation ID required' },
                { status: 400 }
            )
        }

        // Build where clause
        const where: Record<string, unknown> = {
            conversation: { organizationId: dbUser.organizationId },
        }

        if (query) {
            where.OR = [
                { content: { contains: query, mode: 'insensitive' } },
                { mediaCaption: { contains: query, mode: 'insensitive' } },
            ]
        }

        if (conversationId) {
            where.conversationId = conversationId
        }

        if (type) {
            where.type = type
        }

        if (direction) {
            where.direction = direction
        }

        if (dateFrom || dateTo) {
            const createdAtFilter: { gte?: Date; lte?: Date } = {}
            if (dateFrom) {
                createdAtFilter.gte = new Date(dateFrom)
            }
            if (dateTo) {
                createdAtFilter.lte = new Date(dateTo)
            }
            where.createdAt = createdAtFilter
        }

        // Get total count
        const total = await prisma.message.count({ where })

        // Get messages
        const messages = await prisma.message.findMany({
            where,
            include: {
                conversation: {
                    include: {
                        contact: {
                            select: {
                                id: true,
                                name: true,
                                phoneNumber: true,
                                avatarUrl: true,
                            },
                        },
                        channel: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        })

        // Format results with highlights
        const results = messages.map((msg) => ({
            id: msg.id,
            conversationId: msg.conversationId,
            type: msg.type,
            direction: msg.direction,
            content: msg.content,
            mediaUrl: msg.mediaUrl,
            mediaCaption: msg.mediaCaption,
            status: msg.status,
            isAiGenerated: msg.isAiGenerated,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
            senderName: msg.senderName,
            contact: msg.conversation.contact,
            channel: msg.conversation.channel,
            // Highlight matching text
            highlight: query
                ? highlightText(msg.content || msg.mediaCaption || '', query)
                : null,
        }))

        return NextResponse.json({
            data: {
                results,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: page * limit < total,
                },
                query,
            },
        })
    } catch (error) {
        console.error('Error searching messages:', error)
        return NextResponse.json(
            { error: 'Failed to search messages' },
            { status: 500 }
        )
    }
}

function highlightText(text: string, query: string): string {
    if (!text || !query) return text

    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
}
