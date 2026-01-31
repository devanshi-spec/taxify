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

        const { returnUrl } = await request.json()

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            include: { organization: true },
        })

        if (!dbUser || !dbUser.organization.stripeCustomerId) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: dbUser.organization.stripeCustomerId,
            return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
        })

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.error('Error creating portal session:', error)
        return NextResponse.json(
            { error: 'Failed to create portal session' },
            { status: 500 }
        )
    }
}
