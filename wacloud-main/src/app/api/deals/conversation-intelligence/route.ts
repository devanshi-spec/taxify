import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI, analyzeSentiment } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Extract key moments and insights from deal conversations
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
        const { dealId, conversationId } = body

        if (!dealId) {
            return NextResponse.json({ error: 'Deal ID required' }, { status: 400 })
        }

        // Get deal with conversations
        const deal = await prisma.deal.findFirst({
            where: {
                id: dealId,
                organizationId: dbUser.organizationId,
            },
            include: {
                contact: {
                    include: {
                        conversations: {
                            where: conversationId ? { id: conversationId } : {},
                            include: {
                                messages: {
                                    orderBy: { createdAt: 'asc' },
                                },
                            },
                            orderBy: { lastMessageAt: 'desc' },
                            take: conversationId ? 1 : 5,
                        },
                    },
                },
            },
        })

        if (!deal) {
            return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
        }

        const conversations = deal.contact.conversations

        if (conversations.length === 0) {
            return NextResponse.json({ error: 'No conversations found' }, { status: 404 })
        }

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'conversation-intelligence',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            // Analyze each conversation
            const conversationAnalyses = await Promise.all(
                conversations.map(async (conv) => {
                    const transcript = conv.messages
                        .map(m => `[${new Date(m.createdAt).toLocaleTimeString()}] ${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}: ${m.content || '[media]'}`)
                        .join('\n')

                    // Analyze sentiment of customer messages
                    const customerMessages = conv.messages
                        .filter(m => m.direction === 'INBOUND' && m.content)
                        .map(m => m.content!)

                    const sentiments = await Promise.all(
                        customerMessages.slice(0, 10).map(msg => analyzeSentiment(msg))
                    )

                    const avgSentiment = sentiments.length > 0
                        ? sentiments.filter(s => s.sentiment === 'positive').length / sentiments.length
                        : 0.5

                    const prompt = `Analyze this sales conversation and extract key insights.

Deal: ${deal.title} ($${deal.value})

Conversation transcript:
${transcript}

Extract and identify:
1. Key moments (buying signals, objections, commitments, concerns)
2. Customer needs and pain points
3. Mentioned competitors
4. Decision-making criteria
5. Timeline indicators
6. Budget discussions
7. Stakeholders mentioned
8. Next steps agreed upon

Return as JSON:
{
  "keyMoments": [
    {
      "timestamp": "time",
      "type": "buying-signal|objection|commitment|concern|question",
      "description": "what happened",
      "importance": "high|medium|low",
      "quote": "relevant quote from conversation"
    }
  ],
  "needs": ["list of customer needs"],
  "painPoints": ["list of pain points"],
  "competitors": ["mentioned competitors"],
  "decisionCriteria": ["what matters to customer"],
  "timeline": {
    "urgency": "immediate|soon|flexible",
    "indicators": ["timeline clues"]
  },
  "budget": {
    "mentioned": boolean,
    "indicators": ["budget-related discussions"]
  },
  "stakeholders": ["people mentioned in decision"],
  "nextSteps": ["agreed actions"],
  "summary": "brief conversation summary"
}`

                    const response = await completeAI({
                        model: 'gpt-4o',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.4,
                        responseFormat: 'json',
                    })

                    const analysis = JSON.parse(response.content)

                    return {
                        conversationId: conv.id,
                        messageCount: conv.messages.length,
                        avgSentiment,
                        analysis,
                    }
                })
            )

            await monitor.logSuccess(3000, 1200)

            // Aggregate insights across all conversations
            const allKeyMoments = conversationAnalyses.flatMap(c => c.analysis.keyMoments)
            const allNeeds = [...new Set(conversationAnalyses.flatMap(c => c.analysis.needs))]
            const allPainPoints = [...new Set(conversationAnalyses.flatMap(c => c.analysis.painPoints))]
            const allCompetitors = [...new Set(conversationAnalyses.flatMap(c => c.analysis.competitors))]

            // Update deal with intelligence data
            await prisma.deal.update({
                where: { id: deal.id },
                data: {
                    customFields: {
                        ...(deal.customFields as object || {}),
                        aiKeyMoments: allKeyMoments,
                        aiNeeds: allNeeds,
                        aiPainPoints: allPainPoints,
                        aiCompetitors: allCompetitors,
                        lastIntelligenceUpdate: new Date().toISOString(),
                    },
                },
            })

            return NextResponse.json({
                data: {
                    dealId: deal.id,
                    dealTitle: deal.title,
                    conversationsAnalyzed: conversationAnalyses.length,
                    insights: {
                        keyMoments: allKeyMoments,
                        needs: allNeeds,
                        painPoints: allPainPoints,
                        competitors: allCompetitors,
                    },
                    conversations: conversationAnalyses,
                    analyzedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error analyzing conversation intelligence:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to analyze conversations' },
            { status: 500 }
        )
    }
}
