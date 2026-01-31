import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'

// Analyze and optimize existing chatbot flow
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
        const { chatbotId, flowData } = body

        if (!chatbotId || !flowData) {
            return NextResponse.json(
                { error: 'Chatbot ID and flow data required' },
                { status: 400 }
            )
        }

        // Verify chatbot ownership
        const chatbot = await prisma.chatbot.findFirst({
            where: {
                id: chatbotId,
                organizationId: dbUser.organizationId,
            },
        })

        if (!chatbot) {
            return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
        }

        // Get conversation count
        const conversationCount = await prisma.conversation.count({
            where: { aiSessionId: chatbot.id },
        })

        // Get conversation analytics if available
        const analytics = await prisma.conversation.groupBy({
            by: ['status'],
            where: { aiSessionId: chatbot.id },
            _count: true,
        })

        const prompt = `You are an expert chatbot flow optimizer. Analyze this chatbot flow and provide optimization suggestions.

Chatbot: ${chatbot.name}
Total conversations: ${conversationCount}Count}

Flow structure:
${JSON.stringify(flowData, null, 2)}

Conversation analytics:
${JSON.stringify(analytics, null, 2)}

Analyze the flow and provide:
1. **Performance Score** (0-100): Overall flow quality
2. **Issues**: List of problems or inefficiencies
3. **Suggestions**: Specific actionable improvements
4. **Optimizations**: Recommended changes to nodes/edges
5. **Best Practices**: What the flow does well

Consider:
- Flow complexity and user experience
- Dead ends or unreachable nodes
- Missing error handling
- Opportunities for AI enhancement
- Conversation drop-off points
- Response time optimization
- Personalization opportunities

Return as JSON:
{
  "score": number,
  "issues": [
    {
      "severity": "high|medium|low",
      "type": "complexity|dead-end|missing-handler|performance|ux",
      "description": "string",
      "nodeId": "optional node id",
      "suggestion": "how to fix"
    }
  ],
  "suggestions": [
    {
      "priority": "high|medium|low",
      "category": "performance|ux|ai|personalization|error-handling",
      "title": "string",
      "description": "string",
      "impact": "expected improvement"
    }
  ],
  "optimizations": {
    "nodesToAdd": [],
    "nodesToRemove": [],
    "nodesToModify": [],
    "edgesToAdd": [],
    "edgesToRemove": []
  },
  "strengths": ["list of what works well"]
}`

        const response = await completeAI({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            responseFormat: 'json',
        })

        const analysis = JSON.parse(response.content)

        return NextResponse.json({
            data: {
                chatbotId,
                chatbotName: chatbot.name,
                analysis,
                analyzedAt: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error('Error analyzing flow:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to analyze flow' },
            { status: 500 }
        )
    }
}
