import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'

// Generate flow from natural language description
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
        const { description, chatbotId } = body

        if (!description) {
            return NextResponse.json({ error: 'Description required' }, { status: 400 })
        }

        // Verify chatbot ownership
        if (chatbotId) {
            const chatbot = await prisma.chatbot.findFirst({
                where: {
                    id: chatbotId,
                    organizationId: dbUser.organizationId,
                },
            })

            if (!chatbot) {
                return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
            }
        }

        // Generate flow using AI
        const prompt = `You are an expert chatbot flow designer. Generate a complete chatbot flow based on this description:

"${description}"

Create a flow with nodes and edges in React Flow format. Use these node types:
- start: Entry point (only one)
- message: Send a message
- question: Ask a question and wait for response
- condition: Branch based on conditions
- ai: Generate AI response
- action: Perform an action
- delay: Wait before continuing
- media: Send media (image, video, document)
- template: Send WhatsApp template

Return ONLY valid JSON in this exact format:
{
  "nodes": [
    {
      "id": "unique-id",
      "type": "start|message|question|condition|ai|action|delay|media|template",
      "position": { "x": number, "y": number },
      "data": {
        "label": "Node Label",
        // type-specific fields
      }
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "source-node-id",
      "target": "target-node-id",
      "label": "optional label"
    }
  ]
}

Guidelines:
1. Start with a "start" node at position (250, 0)
2. Space nodes vertically by 150px
3. Create a logical flow that accomplishes the goal
4. Use appropriate node types for each step
5. Connect nodes with edges
6. Include helpful labels
7. For question nodes, add "variable" field to store response
8. For condition nodes, create branches with labeled edges
9. Make it production-ready and user-friendly

Generate the flow:`

        const response = await completeAI({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            responseFormat: 'json',
        })

        const flowData = JSON.parse(response.content)

        // Validate flow structure
        if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
            throw new Error('Invalid flow structure: missing nodes array')
        }

        if (!flowData.edges || !Array.isArray(flowData.edges)) {
            throw new Error('Invalid flow structure: missing edges array')
        }

        // Ensure there's exactly one start node
        const startNodes = flowData.nodes.filter((n: { type: string }) => n.type === 'start')
        if (startNodes.length === 0) {
            throw new Error('Flow must have a start node')
        }
        if (startNodes.length > 1) {
            throw new Error('Flow can only have one start node')
        }

        return NextResponse.json({
            data: {
                flowData,
                description,
                generatedAt: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error('Error generating flow:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate flow' },
            { status: 500 }
        )
    }
}
