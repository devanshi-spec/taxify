import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { priceId, planName } = await request.json()

        if (!priceId) {
            return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            include: { organization: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Get or create Stripe Customer
        let customerId = dbUser.organization.stripeCustomerId

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email!,
                name: dbUser.name || undefined,
                metadata: {
                    organizationId: dbUser.organizationId,
                    supabaseUserId: user.id
                }
            })
            customerId = customer.id

            // Save customer ID
            await prisma.organization.update({
                where: { id: dbUser.organizationId },
                data: { stripeCustomerId: customerId }
            })
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
            metadata: {
                organizationId: dbUser.organizationId,
                planName: planName
            }
        })

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.error('Error creating checkout session:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}
