import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Get AI-powered next best action recommendations for a deal
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

        // Get comprehensive deal context
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
                                    take: 20,
                                },
                            },
                            orderBy: { lastMessageAt: 'desc' },
                            take: 2,
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

        const customFields = deal.customFields as {
            aiHealthScore?: number
            aiHealthStatus?: string
            aiWinProbability?: number
            aiKeyMoments?: Array<{ type: string; description: string }>
            aiNeeds?: string[]
            aiPainPoints?: string[]
            aiCompetitors?: string[]
        } | null

        // Calculate time metrics
        const dealAge = Math.floor(
            (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        const daysSinceLastActivity = deal.activities.length > 0
            ? Math.floor(
                (Date.now() - new Date(deal.activities[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
            )
            : dealAge

        const daysUntilExpectedClose = deal.expectedCloseDate
            ? Math.floor(
                (new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
            : null

        // Get recent conversation context
        const recentMessages = deal.contact.conversations
            .flatMap(c => c.messages)
            .slice(0, 10)
            .map(m => `${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}: ${m.content || '[media]'}`)
            .join('\n')

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'next-best-action',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `You are a sales coach. Recommend the next best actions for this deal.

Deal Information:
- Title: ${deal.title}
- Value: $${deal.value}
- Stage: ${deal.stage}
- Pipeline: ${deal.pipeline.name}
- Age: ${dealAge} days
- Days since last activity: ${daysSinceLastActivity}
- Expected close: ${daysUntilExpectedClose !== null ? `${daysUntilExpectedClose} days` : 'Not set'}

AI Insights:
- Health score: ${customFields?.aiHealthScore || 'Not analyzed'}
- Health status: ${customFields?.aiHealthStatus || 'Unknown'}
- Win probability: ${customFields?.aiWinProbability || 'Not calculated'}%
- Customer needs: ${customFields?.aiNeeds?.join(', ') || 'Unknown'}
- Pain points: ${customFields?.aiPainPoints?.join(', ') || 'Unknown'}
- Competitors: ${customFields?.aiCompetitors?.join(', ') || 'None mentioned'}

Recent conversation:
${recentMessages || 'No recent messages'}

Recent activities:
${deal.activities.map(a => `- ${a.type}: ${a.description || 'No description'}`).join('\n') || 'No recent activities'}

Based on this context, recommend the top 3-5 next best actions. Consider:
1. Deal stage and progression
2. Time since last contact
3. Customer engagement and sentiment
4. Identified needs and pain points
5. Competitive situation
6. Timeline pressure

For each action, provide:
- Specific action to take
- Why this action is important now
- Expected outcome
- Priority level
- Estimated effort
- Success indicators

Return as JSON:
{
  "recommendations": [
    {
      "action": "specific action description",
      "reason": "why this is important now",
      "expectedOutcome": "what this should achieve",
      "priority": "critical|high|medium|low",
      "effort": "low|medium|high",
      "timeframe": "immediate|this-week|this-month",
      "successIndicators": ["how to measure success"],
      "tips": ["helpful tips for execution"]
    }
  ],
  "urgentActions": ["list of time-sensitive actions"],
  "riskMitigation": ["actions to reduce deal risk"],
  "opportunityActions": ["actions to increase deal value"],
  "summary": "overall recommendation summary"
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.6,
                responseFormat: 'json',
            })

            const recommendations = JSON.parse(response.content)

            await monitor.logSuccess(2500, 1000)

            // Update deal with recommendations
            await prisma.deal.update({
                where: { id: deal.id },
                data: {
                    customFields: {
                        ...(deal.customFields as object || {}),
                        aiRecommendations: recommendations.recommendations,
                        aiUrgentActions: recommendations.urgentActions,
                        lastRecommendationAt: new Date().toISOString(),
                    },
                },
            })

            return NextResponse.json({
                data: {
                    dealId: deal.id,
                    dealTitle: deal.title,
                    dealStage: deal.stage,
                    recommendations: recommendations.recommendations,
                    urgentActions: recommendations.urgentActions,
                    riskMitigation: recommendations.riskMitigation,
                    opportunityActions: recommendations.opportunityActions,
                    summary: recommendations.summary,
                    generatedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error generating next best actions:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
            { status: 500 }
        )
    }
}
