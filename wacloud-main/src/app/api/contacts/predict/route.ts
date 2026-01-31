import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Predictive analytics for contacts (Churn Risk, LTV)
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

        // Get historical data
        const contact = await prisma.contact.findFirst({
            where: {
                id: contactId,
                organizationId: dbUser.organizationId,
            },
            include: {
                deals: {
                    orderBy: { createdAt: 'desc' },
                },
                conversations: {
                    orderBy: { lastMessageAt: 'desc' },
                    take: 10,
                }
            },
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Calculate metrics
        const dealHistory = contact.deals?.map(d => ({
            value: d.value,
            status: d.stage, // Assuming stage indicates status roughly
            date: d.createdAt,
        })) || []

        const totalSpent = dealHistory.reduce((sum, d) => sum + (d.value || 0), 0)
        const dealCount = dealHistory.length
        const avgDealValue = dealCount > 0 ? totalSpent / dealCount : 0
        const customerAgeDays = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24))

        // Engagement trend
        const recentActivity = contact.conversations.length > 0
            ? new Date(contact.conversations[0].lastMessageAt || new Date()).getTime()
            : 0
        const daysSinceLastActive = recentActivity ? Math.floor((Date.now() - recentActivity) / (1000 * 60 * 60 * 24)) : 999

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'contact-prediction',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `Perform predictive analytics for this contact.

History:
- Total Value: $${totalSpent}
- Deal Count: ${dealCount}
- Average Deal: $${avgDealValue}
- Customer Since: ${customerAgeDays} days ago
- Days Inactive: ${daysSinceLastActive}
- Current Engagement: ${daysSinceLastActive < 30 ? 'Active' : 'Dormant'}

Analyze and Predict:
1. Churn Risk (0-100%): Probability of stopping business
2. Predicted LTV: Estimated future value
3. Next Likely Purchase: When and what might they buy?
4. Loyalty Score: 1-10

Return as JSON:
{
  "churnRisk": number,
  "churnFactors": ["reasons for risk"],
  "predictedLTV": number,
  "ltvReasoning": "basis for calculation",
  "loyaltyScore": number,
  "nextPurchase": {
    "probability": "high|medium|low",
    "estimatedDate": "string",
    "suggestedProduct": "string"
  }
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
                responseFormat: 'json',
            })

            const analysis = JSON.parse(response.content)

            await monitor.logSuccess(800, 400)

            // Update contact
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    customFields: {
                        ...(contact.customFields as object || {}),
                        aiChurnRisk: analysis.churnRisk,
                        aiPredictedLTV: analysis.predictedLTV,
                        aiLoyaltyScore: analysis.loyaltyScore,
                        lastPredictionAt: new Date().toISOString(),
                    }
                }
            })

            return NextResponse.json({
                data: {
                    contactId: contact.id,
                    metrics: {
                        totalSpent,
                        dealCount,
                        daysInactive: daysSinceLastActive
                    },
                    predictions: analysis,
                    analyzedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error predicting contact metrics:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to predict metrics' },
            { status: 500 }
        )
    }
}
