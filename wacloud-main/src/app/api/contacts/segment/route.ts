import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// AI-powered smart segmentation
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
        const { contactId } = body

        if (!contactId) {
            return NextResponse.json({ error: 'Contact ID required' }, { status: 400 })
        }

        // Get comprehensive contact data
        const contact = await prisma.contact.findFirst({
            where: {
                id: contactId,
                organizationId: dbUser.organizationId,
            },
            include: {
                conversations: {
                    include: {
                        messages: {
                            where: { direction: 'INBOUND' },
                            take: 20,
                        },
                    },
                    orderBy: { lastMessageAt: 'desc' },
                    take: 5,
                },
                deals: {
                    where: { stage: { not: 'LOST' } },
                },
            },
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Build behavioral profile
        const messageCount = contact.conversations.reduce((sum, c) => sum + c.messages.length, 0)
        const dealCount = contact.deals?.length || 0
        const totalDealValue = contact.deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0
        const lastActive = contact.lastContactedAt ? new Date(contact.lastContactedAt).toLocaleDateString() : 'Inactive'

        const recentTopics = contact.conversations
            .flatMap(c => c.messages.map(m => m.content))
            .filter(Boolean)
            .slice(0, 10)
            .join(' | ')

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'smart-segmentation',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `Analyze this contact and suggest appropriate segments/tags.

Contact Profile:
- Name: ${contact.name}
- Activity: ${messageCount} inbound messages
- Last Active: ${lastActive}
- Deals: ${dealCount} active deals
- Total Value: $${totalDealValue}
- Current Tags: ${contact.tags.join(', ') || 'None'}

Recent Discussion Topics:
${recentTopics || 'None'}

Enriched Data:
${JSON.stringify((contact.customFields as any)?.aiExtractedData || {})}

Rules:
- High Value: > $1000 total value or > 2 active deals
- Highly Engaged: > 20 messages or active in last 3 days
- At Risk: No activity for 30 days but has deals
- Technical/Business/Executive: Based on role/topics

Suggest:
1. Smart Segments (behavioral/demographic groups)
2. Tags to Add (specific attributes)
3. Tags to Remove (outdated/incorrect)
4. Persona Type

Return as JSON:
{
  "segments": ["list of segments"],
  "suggestedTags": ["tags to add"],
  "tagsToRemove": ["tags to remove"],
  "persona": "description of contact persona",
  "reasoning": "why these segments were chosen"
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                responseFormat: 'json',
            })

            const analysis = JSON.parse(response.content)

            await monitor.logSuccess(1000, 500)

            // Calculate new tags list
            const currentTags = new Set(contact.tags)
            analysis.tagsToRemove.forEach((t: string) => currentTags.delete(t))
            analysis.suggestedTags.forEach((t: string) => currentTags.add(t))

            // Update contact
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    tags: Array.from(currentTags),
                    segment: analysis.segments[0] || contact.segment, // Primary segment
                    customFields: {
                        ...(contact.customFields as object || {}),
                        aiSegments: analysis.segments,
                        aiPersona: analysis.persona,
                        lastSegmentationAt: new Date().toISOString(),
                    }
                }
            })

            return NextResponse.json({
                data: {
                    contactId: contact.id,
                    segments: analysis.segments,
                    tags: Array.from(currentTags),
                    persona: analysis.persona,
                    reasoning: analysis.reasoning,
                    updatedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error segmenting contact:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to segment contact' },
            { status: 500 }
        )
    }
}
