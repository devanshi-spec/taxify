import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { createBillingPortalSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: {
                id: true,
                organizationId: true,
                role: true,
                organization: {
                    select: {
                        id: true,
                        subscription: {
                            select: {
                                stripeCustomerId: true,
                            },
                        },
                    },
                },
            },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only owners and admins can manage billing
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const customerId = dbUser.organization.subscription?.stripeCustomerId

        if (!customerId) {
            return NextResponse.json(
                { error: 'No active subscription found' },
                { status: 400 }
            )
        }

        // Create billing portal session
        const session = await createBillingPortalSession({
            customerId,
            returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
        })

        return NextResponse.json({
            url: session.url,
        })
    } catch (error) {
        console.error('Error creating billing portal session:', error)
        return NextResponse.json(
            { error: 'Failed to create billing portal session' },
            { status: 500 }
        )
    }
}
