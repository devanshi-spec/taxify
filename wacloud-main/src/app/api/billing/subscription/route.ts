import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            include: {
                organization: {
                    include: {
                        subscription: true,
                    },
                },
            },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({
            subscription: dbUser.organization.subscription || {
                plan: dbUser.organization.plan,
                status: 'FREE',
            },
        })
    } catch (error) {
        console.error('Error fetching subscription:', error)
        return NextResponse.json(
            { error: 'Failed to fetch subscription' },
            { status: 500 }
        )
    }
}
