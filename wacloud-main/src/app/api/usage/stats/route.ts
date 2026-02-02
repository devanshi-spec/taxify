import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getUsageStats, shouldShowUpgradePrompt } from '@/lib/limits'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const stats = await getUsageStats(dbUser.organizationId)
        const upgradePrompt = await shouldShowUpgradePrompt(dbUser.organizationId)

        return NextResponse.json({
            data: {
                ...stats,
                upgradePrompt,
            },
        })
    } catch (error) {
        console.error('Error fetching usage stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch usage stats' },
            { status: 500 }
        )
    }
}
