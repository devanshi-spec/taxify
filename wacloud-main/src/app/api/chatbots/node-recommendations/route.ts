import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'

// Get smart node recommendations based on current flow context
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
        const { chatbotId, currentNodeId, flowData } = body

        if (!chatbotId || !currentNodeId || !flowData) {
            return NextResponse.json(
                { error: 'Chatbot ID, current node ID, and flow data required' },
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

        // Find current node
        const currentNode = flowData.nodes.find((n: { id: string }) => n.id === currentNodeId)
        if (!currentNode) {
            return NextResponse.json({ error: 'Current node not found' }, { status: 404 })
        }

        // Get connected nodes
        const outgoingEdges = flowData.edges.filter((e: { source: string }) => e.source === currentNodeId)
        const incomingEdges = flowData.edges.filter((e: { target: string }) => e.target === currentNodeId)

        const prompt = `You are an expert chatbot flow designer. Suggest the next best nodes to add after this current node.

Chatbot: ${chatbot.name}
Current node type: ${currentNode.type}
Current node data: ${JSON.stringify(currentNode.data, null, 2)}

Outgoing connections: ${outgoingEdges.length}
Incoming connections: ${incomingEdges.length}

Full flow context:
${JSON.stringify(flowData, null, 2)}

Suggest 3-5 logical next nodes that would make sense in this flow. Consider:
- The current node's purpose and type
- What typically comes next in a conversation
- Error handling and edge cases
- User experience and flow logic
- Opportunities for AI enhancement

Available node types:
- message: Send a message
- question: Ask a question and wait for response
- condition: Branch based on conditions
- ai: Generate AI response
- action: Perform an action (create deal, update contact, etc.)
- delay: Wait before continuing
- media: Send media
- template: Send WhatsApp template

Return as JSON:
{
  "recommendations": [
    {
      "nodeType": "message|question|condition|ai|action|delay|media|template",
      "title": "string",
      "description": "why this makes sense",
      "priority": "high|medium|low",
      "suggestedData": {
        "label": "string",
        // other node-specific fields
      },
      "reasoning": "detailed explanation",
      "benefits": ["list of benefits"]
    }
  ]
}`

        const response = await completeAI({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            responseFormat: 'json',
        })

        const recommendations = JSON.parse(response.content)

        return NextResponse.json({
            data: {
                chatbotId,
                currentNodeId,
                currentNodeType: currentNode.type,
                recommendations: recommendations.recommendations,
                generatedAt: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error('Error generating node recommendations:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
            { status: 500 }
        )
    }
}
