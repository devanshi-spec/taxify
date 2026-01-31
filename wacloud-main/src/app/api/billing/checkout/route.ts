import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { createCheckoutSession, PlanType, STRIPE_PLANS } from '@/lib/stripe'
import { z } from 'zod'

const checkoutSchema = z.object({
    plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
})

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
                        plan: true,
                        subscription: true,
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

        const body = await request.json()
        const { plan } = checkoutSchema.parse(body)

        // Check if already subscribed
        if (dbUser.organization.subscription?.status === 'ACTIVE') {
            return NextResponse.json(
                { error: 'Organization already has an active subscription' },
                { status: 400 }
            )
        }

        // Create Stripe checkout session
        const session = await createCheckoutSession({
            organizationId: dbUser.organizationId,
            plan,
            successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
        })

        return NextResponse.json({
            sessionId: session.id,
            url: session.url,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error creating checkout session:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}
