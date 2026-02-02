import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Calculate win probability for a deal
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
        const { dealId } = body

        if (!dealId) {
            return NextResponse.json({ error: 'Deal ID required' }, { status: 400 })
        }

        // Get deal with full context
        const deal = await prisma.deal.findFirst({
            where: {
                id: dealId,
                organizationId: dbUser.organizationId,
            },
            include: {
                contact: {
                    include: {
                        conversations: {
                            include: {
                                messages: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 30,
                                },
                            },
                            orderBy: { lastMessageAt: 'desc' },
                            take: 3,
                        },
                    },
                },
                pipeline: true,
                activities: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        })

        if (!deal) {
            return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
        }

        // Calculate deal age
        const dealAge = Math.floor(
            (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        // Build conversation context
        const conversationContext = deal.contact.conversations
            .map(conv => {
                const messages = conv.messages
                    .slice(0, 10)
                    .map(m => `${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}: ${m.content || '[media]'}`)
                    .join('\n')
                return messages
            })
            .join('\n\n')

        // Build activity context
        const activityContext = deal.activities
            .map(a => `${a.type}: ${a.description || 'No description'}`)
            .join('\n')

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'win-probability',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `Analyze this sales deal and predict the win probability.

Deal Information:
- Title: ${deal.title}
- Value: $${deal.value}
- Stage: ${deal.stage}
- Pipeline: ${deal.pipeline.name}
- Age: ${dealAge} days
- Expected close: ${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'Not set'}

Contact: ${deal.contact.name || 'Unknown'}
Company: ${(deal.contact.customFields as { company?: string })?.company || 'Unknown'}

Recent conversation:
${conversationContext || 'No recent conversations'}

Recent activities:
${activityContext || 'No recent activities'}

Analyze and provide:
1. Win probability (0-100%)
2. Confidence level (low/medium/high)
3. Key factors influencing the probability
4. Risk factors
5. Recommended actions to increase win probability

Return as JSON:
{
  "winProbability": number,
  "confidence": "low|medium|high",
  "factors": {
    "positive": ["list of positive factors"],
    "negative": ["list of negative factors"]
  },
  "risks": [
    {
      "risk": "description",
      "severity": "low|medium|high",
      "mitigation": "how to address"
    }
  ],
  "recommendations": [
    {
      "action": "specific action",
      "priority": "high|medium|low",
      "expectedImpact": "description"
    }
  ],
  "reasoning": "detailed explanation"
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
                responseFormat: 'json',
            })

            const analysis = JSON.parse(response.content)

            await monitor.logSuccess(2000, 800)

            // Update deal with win probability
            await prisma.deal.update({
                where: { id: deal.id },
                data: {
                    customFields: {
                        ...(deal.customFields as object || {}),
                        aiWinProbability: analysis.winProbability,
                        aiConfidence: analysis.confidence,
                        aiRisks: analysis.risks,
                        aiRecommendations: analysis.recommendations,
                        lastAnalyzedAt: new Date().toISOString(),
                    },
                },
            })

            return NextResponse.json({
                data: {
                    dealId: deal.id,
                    dealTitle: deal.title,
                    winProbability: analysis.winProbability,
                    confidence: analysis.confidence,
                    factors: analysis.factors,
                    risks: analysis.risks,
                    recommendations: analysis.recommendations,
                    reasoning: analysis.reasoning,
                    analyzedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error calculating win probability:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to calculate win probability' },
            { status: 500 }
        )
    }
}
