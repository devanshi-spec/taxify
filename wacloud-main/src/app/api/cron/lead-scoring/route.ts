import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic' // Prevent caching

/**
 * Nightly Lead Scoring Job
 * Calculates a score (0-100) for each contact based on engagement.
 */
export async function GET() {
    try {
        console.log('[Cron] Starting Lead Scoring...')

        // 1. Fetch active contacts with their activity counts
        const contacts = await prisma.contact.findMany({
            where: { isOptedIn: true },
            select: {
                id: true,
                leadScore: true,
                stage: true,
                email: true,
                name: true,
                _count: {
                    select: {
                        messages: true,
                        deals: true
                    }
                }
            },
            take: 1000, // Process in batches
            orderBy: { updatedAt: 'desc' }
        })

        let updatedCount = 0

        // 2. Calculate scores
        for (const contact of contacts) {
            let score = 0

            // Engagement Activity
            // - Inbound messages imply interest (approx. assuming mix of inbound/outbound)
            score += contact._count.messages * 2

            // Business Intent
            if (contact._count.deals > 0) score += 20

            // Lifecycle Stage
            if (contact.stage === 'CUSTOMER') score += 50
            if (contact.stage === 'QUALIFIED') score += 30
            if (contact.stage === 'LEAD') score += 10

            // Profile Completeness
            if (contact.email) score += 10
            if (contact.name) score += 5

            // Cap strictly at 100
            score = Math.min(score, 100)

            // 3. Update only if changed
            if (contact.leadScore !== score) {
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { leadScore: score }
                })
                updatedCount++
            }
        }

        console.log(`[Cron] Lead Scoring Complete. Updated ${updatedCount}/${contacts.length} contacts.`)

        return NextResponse.json({
            success: true,
            processed: contacts.length,
            updated: updatedCount
        })

    } catch (error) {
        console.error('[Cron] Lead Scoring Failed:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
