import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET: Get CTWA attribution analytics
export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const period = searchParams.get('period') || '30d'

        // Calculate date range
        const now = new Date()
        let startDate: Date

        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                break
            default: // 30d
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        }

        // Get contacts by source
        const [
            totalContacts,
            contactsBySource,
            ctwaContacts,
            contactsWithDeals,
            totalDealsValue,
        ] = await Promise.all([
            // Total contacts in period
            prisma.contact.count({
                where: {
                    organizationId: dbUser.organizationId,
                    createdAt: { gte: startDate },
                },
            }),

            // Contacts grouped by source
            prisma.contact.groupBy({
                by: ['source'],
                where: {
                    organizationId: dbUser.organizationId,
                    createdAt: { gte: startDate },
                },
                _count: true,
            }),

            // CTWA contacts with campaign details
            prisma.contact.findMany({
                where: {
                    organizationId: dbUser.organizationId,
                    source: 'ctwa',
                    createdAt: { gte: startDate },
                },
                select: {
                    id: true,
                    fbCampaignId: true,
                    adId: true,
                    adSetId: true,
                    utmCampaign: true,
                    utmSource: true,
                },
            }),

            // Contacts that converted to deals
            prisma.contact.count({
                where: {
                    organizationId: dbUser.organizationId,
                    source: 'ctwa',
                    createdAt: { gte: startDate },
                    deals: { some: {} },
                },
            }),

            // Total value of deals from CTWA contacts
            prisma.deal.aggregate({
                where: {
                    contact: {
                        organizationId: dbUser.organizationId,
                        source: 'ctwa',
                        createdAt: { gte: startDate },
                    },
                },
                _sum: { value: true },
            }),
        ])

        // Calculate metrics
        const ctwaCount = contactsBySource.find(s => s.source === 'ctwa')?._count || 0
        const organicCount = contactsBySource.find(s => s.source === 'organic')?._count || 0
        const apiCount = contactsBySource.find(s => s.source === 'api')?._count || 0

        // Group by campaign
        const campaignBreakdown: Record<string, number> = {}
        for (const contact of ctwaContacts) {
            const campaign = contact.utmCampaign || contact.fbCampaignId || 'Unknown Campaign'
            campaignBreakdown[campaign] = (campaignBreakdown[campaign] || 0) + 1
        }

        const conversionRate = ctwaCount > 0
            ? Math.round((contactsWithDeals / ctwaCount) * 100)
            : 0

        const avgDealValue = contactsWithDeals > 0 && totalDealsValue._sum.value
            ? Math.round(totalDealsValue._sum.value / contactsWithDeals)
            : 0

        return NextResponse.json({
            data: {
                overview: {
                    totalContacts,
                    ctwaContacts: ctwaCount,
                    organicContacts: organicCount,
                    apiContacts: apiCount,
                    ctwaPercentage: totalContacts > 0 ? Math.round((ctwaCount / totalContacts) * 100) : 0,
                },
                attribution: {
                    contactsFromAds: ctwaCount,
                    contactsConverted: contactsWithDeals,
                    conversionRate,
                    totalRevenue: totalDealsValue._sum.value || 0,
                    avgDealValue,
                },
                campaigns: Object.entries(campaignBreakdown)
                    .map(([campaign, count]) => ({ campaign, contacts: count }))
                    .sort((a, b) => b.contacts - a.contacts)
                    .slice(0, 10),
                sourceBreakdown: contactsBySource.map(s => ({
                    source: s.source || 'unknown',
                    count: s._count,
                    percentage: totalContacts > 0 ? Math.round((s._count / totalContacts) * 100) : 0,
                })),
                period,
            },
        })
    } catch (error) {
        console.error('Error fetching CTWA attribution:', error)
        return NextResponse.json(
            { error: 'Failed to fetch attribution data' },
            { status: 500 }
        )
    }
}
