import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { completeAI } from '@/lib/ai'
import { AIMonitor } from '@/lib/ai/monitoring'

// AI-powered duplicate detection
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
        const { contactId, checkAll = false } = body

        // Helper to fetch candidates
        async function getCandidates(targetContact: any) {
            // Simple fuzzy match candidates based on phone or email overlap
            // In a real scenario, we might use pg_trgm or similarity search
            // Here we'll fetch a batch and let AI compare
            return await prisma.contact.findMany({
                where: {
                    organizationId: dbUser!.organizationId,
                    id: { not: targetContact.id },
                    OR: [
                        { name: { contains: targetContact.name?.split(' ')[0] || '', mode: 'insensitive' } },
                        { email: targetContact.email ? { equals: targetContact.email } : undefined },
                        // Phone overlap (e.g. last 6 digits)
                        { phoneNumber: { contains: targetContact.phoneNumber.slice(-6) } }
                    ]
                },
                take: 10
            })
        }

        const monitor = new AIMonitor({
            organizationId: dbUser.organizationId,
            userId: dbUser.id,
            feature: 'duplicate-detection',
            model: 'gpt-4o',
            provider: 'openai',
        })

        // If checking a specific contact
        if (contactId) {
            const contact = await prisma.contact.findUnique({
                where: { id: contactId }
            })

            if (!contact) {
                return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
            }

            const candidates = await getCandidates(contact)
            if (candidates.length === 0) {
                return NextResponse.json({ data: { duplicates: [] } })
            }

            try {
                const prompt = `Compare this contact with potential duplicates and identify matches.

Target Contact:
- Name: ${contact.name}
- Phone: ${contact.phoneNumber}
- Email: ${contact.email || 'N/A'}
- Custom Fields: ${JSON.stringify(contact.customFields || {})}

Potential Duplicates:
${candidates.map(c => `ID: ${c.id}
- Name: ${c.name}
- Phone: ${c.phoneNumber}
- Email: ${c.email || 'N/A'}`).join('\n\n')}

Analyze similarity and determine if they represent the same person.
Consider:
- typos in names
- varied phone formats
- same email
- nickname vs full name

Return as JSON:
{
  "matches": [
    {
      "candidateId": "id",
      "confidence": number, // 0-100
      "reason": "why it is a duplicate",
      "action": "merge|ignore"
    }
  ]
}`

                const response = await completeAI({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1, // Low temp for logic
                    responseFormat: 'json',
                })

                const analysis = JSON.parse(response.content)
                await monitor.logSuccess(1000, 300)

                const highConfidenceMatches = analysis.matches
                    .filter((m: any) => m.confidence > 70)
                    .map((m: any) => ({
                        ...m,
                        candidate: candidates.find(c => c.id === m.candidateId)
                    }))

                // Store duplicate warning
                if (highConfidenceMatches.length > 0) {
                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: {
                            customFields: {
                                ...(contact.customFields as object || {}),
                                aiPotentialDuplicates: highConfidenceMatches.map((m: any) => m.candidateId)
                            }
                        }
                    })
                }

                return NextResponse.json({
                    data: {
                        contactId,
                        duplicates: highConfidenceMatches,
                        analyzedAt: new Date().toISOString()
                    }
                })

            } catch (error) {
                await monitor.logError(error as Error)
                throw error
            }
        }

        // Batch check: check multiple phone numbers for duplicates
        if (checkAll) {
            const body2 = await request.json().catch(() => ({}))
            const { phoneNumbers } = body2 as { phoneNumbers?: string[] }

            if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
                // If no phone numbers provided, just return existing duplicates in the org
                const contactsWithDuplicates = await prisma.contact.findMany({
                    where: {
                        organizationId: dbUser.organizationId,
                        customFields: {
                            path: ['aiPotentialDuplicates'],
                            not: 'null'
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true,
                        customFields: true
                    },
                    take: 50
                })

                return NextResponse.json({
                    data: {
                        contactsWithDuplicates,
                        total: contactsWithDuplicates.length
                    }
                })
            }

            // Check which phone numbers already exist in organization
            const existingContacts = await prisma.contact.findMany({
                where: {
                    organizationId: dbUser.organizationId,
                    phoneNumber: { in: phoneNumbers }
                },
                select: {
                    id: true,
                    phoneNumber: true,
                    name: true,
                    email: true
                }
            })

            const existingPhoneNumbers = new Set(existingContacts.map(c => c.phoneNumber))
            const duplicates: Record<string, { exists: boolean; contactId?: string; contact?: typeof existingContacts[0] }> = {}

            phoneNumbers.forEach(phone => {
                const existing = existingContacts.find(c => c.phoneNumber === phone)
                duplicates[phone] = {
                    exists: existingPhoneNumbers.has(phone),
                    contactId: existing?.id,
                    contact: existing
                }
            })

            return NextResponse.json({
                data: {
                    duplicates,
                    total: phoneNumbers.length,
                    duplicateCount: existingContacts.length
                }
            })
        }

        return NextResponse.json({ error: 'Please provide contactId or set checkAll=true with phoneNumbers array' }, { status: 400 })

    } catch (error) {
        console.error('Error checking duplicates:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to check duplicates' },
            { status: 500 }
        )
    }
}
