import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getAIUsageStats, getAIUsageTrends, checkAIBudget } from '@/lib/ai/monitoring'

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
        const days = parseInt(searchParams.get('days') || '30')

        // Calculate date range
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        // Fetch all stats concurrently
        const [overallStats, trends, budget] = await Promise.all([
            getAIUsageStats(dbUser.organizationId, startDate, endDate),
            getAIUsageTrends(dbUser.organizationId, days),
            checkAIBudget(dbUser.organizationId, 50) // Default budget $50, should be configurable in settings db
        ])

        return NextResponse.json({
            data: {
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    days
                },
                stats: overallStats,
                trends,
                budget
            }
        })

    } catch (error) {
        console.error('Error fetching AI analytics:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch analytics' },
            { status: 500 }
        )
    }
}
