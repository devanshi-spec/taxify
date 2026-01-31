
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { generateChatbotResponse } from '@/lib/ai/core-services'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { conversationId, context } = await request.json()

        if (!conversationId) {
            return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
        }

        // Verify conversation access
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                contact: true,
            },
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Prepare history for AI
        // Reverse messages to be chronological for the AI context
        const history = conversation.messages
            .slice()
            .reverse()
            .map(m => `${m.direction === 'OUTBOUND' ? 'Agent' : 'User'}: ${m.content || '[Media]'}`)
            .join('\n')

        const lastMessage = conversation.messages[0]?.content || ''

        const reply = await generateChatbotResponse({
            businessName: 'Our Business', // You might want to fetch this from Org settings
            conversationHistory: history,
            userMessage: lastMessage, // The last user message is the trigger
            tone: 'professional',
            maxLength: 150,
            useCache: false,
        })

        return NextResponse.json({ reply })
    } catch (error) {
        console.error('Failed to generate AI reply:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: `AI Generation Failed: ${errorMessage}` }, { status: 500 })
    }
}
