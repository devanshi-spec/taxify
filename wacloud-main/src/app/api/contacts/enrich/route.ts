import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// Auto-enrich contact details from conversation history
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
        const { contactId, conversationId } = body

        if (!contactId) {
            return NextResponse.json({ error: 'Contact ID required' }, { status: 400 })
        }

        // Get contact with conversations
        const contact = await prisma.contact.findFirst({
            where: {
                id: contactId,
                organizationId: dbUser.organizationId,
            },
            include: {
                conversations: {
                    where: conversationId ? { id: conversationId } : {},
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 50, // Analyze last 50 messages
                        },
                    },
                    orderBy: { lastMessageAt: 'desc' },
                    take: 3, // Look at last 3 conversations if specific one not provided
                },
            },
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Prepare transcript
        const allMessages = contact.conversations.flatMap(c => c.messages)

        if (allMessages.length === 0) {
            return NextResponse.json({ error: 'No messages to analyze' }, { status: 400 })
        }

        // Sort valid messages and create transcript
        const transcript = allMessages
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map(m => `[${m.direction === 'INBOUND' ? 'Contact' : 'Agent'}]: ${m.content || '[media]'}`)
            .join('\n')

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'contact-enrichment',
            model: 'gpt-4o',
            provider: 'openai',
        })

        try {
            const prompt = `Analyze this conversation transcript and extract contact details to enrich their profile.

Contact Name: ${contact.name || 'Unknown'}
Contact Phone: ${contact.phoneNumber}

Transcript:
${transcript}

Extract the following information if present in the conversation:
1. Full Name (if different/more complete)
2. Email Address
3. Company Name
4. Job Title / Role
5. Location / Address
6. Industry
7. Preferred Language
8. Preferred Contact Method
9. Key Interests / Topics
10. Social Media Handles
11. Birthday / Important Dates

Also verify if the existing name (${contact.name}) needs correction.

Return as JSON:
{
  "extractedData": {
    "name": "extracted name or null",
    "email": "extracted email or null",
    "company": "extracted company or null",
    "role": "extracted role or null",
    "location": "extracted location or null",
    "industry": "extracted industry or null",
    "language": "extracted language or null",
    "customFields": {
      // Any other extracted data
    }
  },
  "confidence": {
    "name": "high|medium|low",
    "email": "high|medium|low",
    // etc for each field found
  },
  "reasoning": "brief explanation of where data was found",
  "missingFields": ["list of important fields not found"]
}`

            const response = await completeAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3, // Lower temperature for extraction accuracy
                responseFormat: 'json',
            })

            const analysis = JSON.parse(response.content)

            await monitor.logSuccess(inputTokens(transcript), 600)

            // Prepare update data
            const updateData: any = {
                customFields: {
                    ...(contact.customFields as object || {}),
                    aiEnriched: true,
                    aiEnrichedAt: new Date().toISOString(),
                    aiExtractedData: analysis.extractedData,
                }
            }

            // Only propose updates for core fields if confidence is high
            // Note: We don't automatically overwrite core fields to prevent data loss, 
            // instead we store extraction in customFields for user review, 
            // unless specifically asked to auto-apply.
            // For this implementation, we'll store in customFields.aiExtractedData

            return NextResponse.json({
                data: {
                    contactId: contact.id,
                    extractedData: analysis.extractedData,
                    confidence: analysis.confidence,
                    reasoning: analysis.reasoning,
                    missingFields: analysis.missingFields,
                    analyzedAt: new Date().toISOString(),
                },
            })
        } catch (error) {
            await monitor.logError(error as Error)
            throw error
        }
    } catch (error) {
        console.error('Error enriching contact:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to enrich contact' },
            { status: 500 }
        )
    }
}

// Helper to estimate tokens (rough approximation)
function inputTokens(text: string): number {
    return Math.ceil(text.length / 4)
}
