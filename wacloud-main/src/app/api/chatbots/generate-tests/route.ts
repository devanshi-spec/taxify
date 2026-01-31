import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'

// Generate AI test scenarios for chatbot flow
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
        const { chatbotId, flowData, scenarioCount = 5 } = body

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

        const prompt = `You are an expert QA tester for chatbots. Generate ${scenarioCount} realistic test scenarios for this chatbot flow.

Chatbot: ${chatbot.name}
Description: ${chatbot.description || 'No description'}

Flow structure:
${JSON.stringify(flowData, null, 2)}

Generate diverse test scenarios that cover:
1. Happy path (ideal user journey)
2. Edge cases (unexpected inputs)
3. Error scenarios (invalid responses)
4. Different user personas
5. Various conversation styles

For each scenario, provide:
- Persona description
- User goal
- Step-by-step conversation
- Expected outcome
- Test assertions

Return as JSON:
{
  "scenarios": [
    {
      "id": "scenario-1",
      "name": "string",
      "persona": {
        "name": "string",
        "description": "string",
        "goal": "string"
      },
      "conversation": [
        {
          "step": number,
          "userInput": "string",
          "expectedBotResponse": "string",
          "expectedNodeType": "message|question|ai|etc",
          "notes": "optional notes"
        }
      ],
      "expectedOutcome": "string",
      "assertions": [
        {
          "type": "response|variable|action|navigation",
          "description": "what to verify",
          "expected": "expected value"
        }
      ]
    }
  ]
}`

        const response = await completeAI({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            responseFormat: 'json',
        })

        const testData = JSON.parse(response.content)

        return NextResponse.json({
            data: {
                chatbotId,
                chatbotName: chatbot.name,
                scenarios: testData.scenarios,
                generatedAt: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error('Error generating test scenarios:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate test scenarios' },
            { status: 500 }
        )
    }
}
