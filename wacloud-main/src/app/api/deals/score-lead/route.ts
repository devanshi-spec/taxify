import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { scoreLead } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// AI-powered lead scoring
export async function POST(request: NextRequest) {
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

        const body = await request.json()
        const { contactId, dealId } = body

        if (!contactId) {
            return NextResponse.json({ error: 'Contact ID required' }, { status: 400 })
        }

        // Get contact with conversation history
        const contact = await prisma.contact.findFirst({
            where: {
                id: contactId,
                organizationId: dbUser.organizationId,
            },
            include: {
                conversations: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 50,
                        },
                    },
                    orderBy: { lastMessageAt: 'desc' },
                    take: 5,
                },
                deals: {
                    where: dealId ? { id: dealId } : {},
                    take: 1,
                },
            },
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Build conversation summary
        const conversationSummary = contact.conversations
            .map(conv => {
                const messages = conv.messages
                    .map(m => `${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}: ${m.content || '[media]'}`)
                    .join('\n')
                return `Conversation (${conv.status}):\n${messages}`
            })
            .join('\n\n')

        // Calculate engagement metrics
        const totalMessages = contact.conversations.reduce(
            (sum, conv) => sum + conv.messages.length,
            0
        )
        const inboundMessages = contact.conversations.reduce(
            (sum, conv) => sum + conv.messages.filter(m => m.direction === 'INBOUND').length,
            0
        )
        const responseRate = totalMessages > 0 ? (inboundMessages / totalMessages) * 100 : 0

        const lastContacted = contact.lastContactedAt
            ? new Date(contact.lastContactedAt).toLocaleDateString()
            : 'Never'

        // Start AI monitoring
        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'lead-scoring',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            // Score the lead using AI
            const customFields = contact.customFields as { company?: string; role?: string } | null
            const scoring = await scoreLead({
                contactName: contact.name || 'Unknown',
                company: customFields?.company,
                role: customFields?.role,
                conversationSummary: conversationSummary || 'No conversation history',
                messageCount: totalMessages,
                responseRate: Math.round(responseRate),
                lastContacted,
            })

            // Log successful AI usage
            await monitor.logSuccess(1500, 500) // Approximate token counts

            // Update contact with lead score
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    leadScore: scoring.score,
                    customFields: {
                        ...(contact.customFields as object || {}),
                        aiLeadScore: scoring.score,
                        aiScoringReason: scoring.reasoning,
                        aiNextAction: scoring.nextAction,
                        lastScoredAt: new Date().toISOString(),
                    },
                },
            })

            // If there's a deal, update it too
            if (contact.deals.length > 0) {
                const deal = contact.deals[0]
                await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        customFields: {
                            ...(deal.customFields as object || {}),
                            aiLeadScore: scoring.score,
                            aiScoringReason: scoring.reasoning,
                            aiNextAction: scoring.nextAction,
                        },
                    },
                })
            }

            return NextResponse.json({
                data: {
                    contactId: contact.id,
                    contactName: contact.name,
                    score: scoring.score,
                    reasoning: scoring.reasoning,
                    nextAction: scoring.nextAction,
                    metrics: {
                        totalMessages,
                        responseRate: Math.round(responseRate),
                        lastContacted,
                    },
                    scoredAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error scoring lead:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to score lead' },
            { status: 500 }
        )
    }
}

// Batch score multiple leads
export async function PUT(request: NextRequest) {
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

        const body = await request.json()
        const { contactIds } = body

        if (!contactIds || !Array.isArray(contactIds)) {
            return NextResponse.json({ error: 'Contact IDs array required' }, { status: 400 })
        }

        const results = []

        for (const contactId of contactIds.slice(0, 10)) { // Limit to 10 at a time
            try {
                const response = await POST(
                    new NextRequest(request.url, {
                        method: 'POST',
                        body: JSON.stringify({ contactId }),
                    })
                )
                const data = await response.json()
                results.push(data.data)
            } catch (error) {
                results.push({
                    contactId,
                    error: error instanceof Error ? error.message : 'Failed to score',
                })
            }
        }

        return NextResponse.json({
            data: {
                results,
                total: results.length,
                successful: results.filter(r => !r.error).length,
            },
        })
    } catch (error) {
        console.error('Error batch scoring leads:', error)
        return NextResponse.json(
            { error: 'Failed to batch score leads' },
            { status: 500 }
        )
    }
}
