import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Monitor deal health and identify at-risk deals
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

        // Get deal with engagement data
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
                                    where: {
                                        createdAt: {
                                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                activities: {
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        })

        if (!deal) {
            return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
        }

        // Calculate health metrics
        const dealAge = Math.floor(
            (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        const daysSinceLastActivity = deal.activities.length > 0
            ? Math.floor(
                (Date.now() - new Date(deal.activities[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
            )
            : dealAge

        const totalMessages = deal.contact.conversations.reduce(
            (sum, conv) => sum + conv.messages.length,
            0
        )

        const inboundMessages = deal.contact.conversations.reduce(
            (sum, conv) => sum + conv.messages.filter(m => m.direction === 'INBOUND').length,
            0
        )

        const responseRate = totalMessages > 0 ? (inboundMessages / totalMessages) * 100 : 0

        const daysUntilExpectedClose = deal.expectedCloseDate
            ? Math.floor(
                (new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
            : null

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'deal-health',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `Analyze this deal's health and identify risks.

Deal: ${deal.title}
Stage: ${deal.stage}
Value: $${deal.value}

Health Metrics:
- Deal age: ${dealAge} days
- Days since last activity: ${daysSinceLastActivity}
- Total messages (30d): ${totalMessages}
- Customer response rate: ${Math.round(responseRate)}%
- Days until expected close: ${daysUntilExpectedClose !== null ? daysUntilExpectedClose : 'Not set'}
- Recent activities: ${deal.activities.length}

Analyze and provide:
1. Health score (0-100, where 100 is healthiest)
2. Health status (healthy/at-risk/critical)
3. Warning signs
4. Actionable insights
5. Recommended interventions

Return as JSON:
{
  "healthScore": number,
  "status": "healthy|at-risk|critical",
  "warnings": [
    {
      "type": "engagement|timeline|activity|communication",
      "severity": "low|medium|high",
      "message": "description",
      "detectedAt": "what triggered this"
    }
  ],
  "insights": [
    {
      "category": "engagement|timeline|value|stage",
      "insight": "observation",
      "impact": "potential consequence"
    }
  ],
  "interventions": [
    {
      "action": "specific action to take",
      "urgency": "immediate|soon|monitor",
      "expectedOutcome": "what this should achieve"
    }
  ],
  "summary": "brief health assessment"
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                responseFormat: 'json',
            })

            const healthAnalysis = JSON.parse(response.content)

            await monitor.logSuccess(1800, 700)

            // Update deal with health data
            await prisma.deal.update({
                where: { id: deal.id },
                data: {
                    customFields: {
                        ...(deal.customFields as object || {}),
                        aiHealthScore: healthAnalysis.healthScore,
                        aiHealthStatus: healthAnalysis.status,
                        aiWarnings: healthAnalysis.warnings,
                        aiInterventions: healthAnalysis.interventions,
                        lastHealthCheckAt: new Date().toISOString(),
                    },
                },
            })

            return NextResponse.json({
                data: {
                    dealId: deal.id,
                    dealTitle: deal.title,
                    healthScore: healthAnalysis.healthScore,
                    status: healthAnalysis.status,
                    warnings: healthAnalysis.warnings,
                    insights: healthAnalysis.insights,
                    interventions: healthAnalysis.interventions,
                    summary: healthAnalysis.summary,
                    metrics: {
                        dealAge,
                        daysSinceLastActivity,
                        responseRate: Math.round(responseRate),
                        daysUntilExpectedClose,
                    },
                    analyzedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error monitoring deal health:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to monitor deal health' },
            { status: 500 }
        )
    }
}

// Get health status for all deals in pipeline
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
        const pipelineId = searchParams.get('pipelineId')

        // Get deals with health data
        const deals = await prisma.deal.findMany({
            where: {
                organizationId: dbUser.organizationId,
                ...(pipelineId ? { pipelineId } : {}),
                stage: { not: 'WON' }, // Exclude won deals
            },
            select: {
                id: true,
                title: true,
                value: true,
                stage: true,
                customFields: true,
                expectedCloseDate: true,
            },
            orderBy: { createdAt: 'desc' },
        })

        const healthData = deals.map(deal => {
            const customFields = deal.customFields as {
                aiHealthScore?: number
                aiHealthStatus?: string
                lastHealthCheckAt?: string
            } | null

            return {
                dealId: deal.id,
                title: deal.title,
                value: deal.value,
                stage: deal.stage,
                healthScore: customFields?.aiHealthScore || null,
                status: customFields?.aiHealthStatus || 'unknown',
                lastChecked: customFields?.lastHealthCheckAt || null,
                needsCheck: !customFields?.lastHealthCheckAt ||
                    new Date(customFields.lastHealthCheckAt).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000,
            }
        })

        const summary = {
            total: healthData.length,
            healthy: healthData.filter(d => d.status === 'healthy').length,
            atRisk: healthData.filter(d => d.status === 'at-risk').length,
            critical: healthData.filter(d => d.status === 'critical').length,
            needsCheck: healthData.filter(d => d.needsCheck).length,
        }

        return NextResponse.json({
            data: {
                deals: healthData,
                summary,
            },
        })
    } catch (error) {
        console.error('Error getting deal health overview:', error)
        return NextResponse.json(
            { error: 'Failed to get deal health overview' },
            { status: 500 }
        )
    }
}
