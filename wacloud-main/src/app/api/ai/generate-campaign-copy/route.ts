import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Generate marketing copy for a campaign
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
        const { name, segment, type } = body

        if (!name) {
            return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
        }

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'campaign-copy',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `You are a world-class copywriter for WhatsApp marketing campaigns.
Create a high-converting, engaging message for a campaign.

Details:
- Campaign Name: ${name}
- Target Segment: ${segment || 'General Customers'}
- Campaign Type: ${type}
- Channel: WhatsApp (Keep it personal, concise, and essentially human)

Requirements:
- Use emojis effectively but not excessively 🌟
- Include a clear Call to Action (CTA)
- Keep it under 1000 characters
- Tone: Professional yet friendly and exciting
- Structure: Hook -> Value Proposition -> CTA

Return ONLY JSON format:
{
  "content": "The generated message text here"
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                responseFormat: 'json',
            })

            const result = JSON.parse(response.content)

            await monitor.logSuccess(1000, 500)

            return NextResponse.json({
                content: result.content,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    model: 'gpt-4o'
                }
            })

        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error generating campaign copy:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate copy' },
            { status: 500 }
        )
    }
}
