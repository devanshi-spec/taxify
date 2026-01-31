import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`)

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
                break

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
                break

            case 'invoice.paid':
                await handleInvoicePaid(event.data.object as Stripe.Invoice)
                break

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
                break

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[Stripe Webhook] Error processing event:', error)
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        )
    }
}

// Handle successful checkout
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const organizationId = session.metadata?.organizationId
    const plan = session.metadata?.plan as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

    if (!organizationId || !plan) {
        console.error('[Stripe] Missing metadata in checkout session')
        return
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

    // Create or update subscription record
    await prisma.subscription.upsert({
        where: { organizationId },
        create: {
            organizationId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCustomerId: subscription.customer as string,
            status: mapStripeStatus(subscription.status),
            plan,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
        update: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            stripeCustomerId: subscription.customer as string,
            status: mapStripeStatus(subscription.status),
            plan,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
    })

    // Update organization plan and limits
    const { STRIPE_PLANS } = await import('@/lib/stripe')
    const planConfig = STRIPE_PLANS[plan]

    await prisma.organization.update({
        where: { id: organizationId },
        data: {
            plan,
            stripeCustomerId: subscription.customer as string,
            maxUsers: planConfig.limits.maxUsers,
            maxChannels: planConfig.limits.maxChannels,
            maxContacts: planConfig.limits.maxContacts,
            maxMessages: planConfig.limits.maxMessages,
        },
    })

    console.log(`[Stripe] Subscription created for organization ${organizationId}`)
}

// Handle subscription updates
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const organizationId = subscription.metadata?.organizationId

    if (!organizationId) {
        console.error('[Stripe] Missing organizationId in subscription metadata')
        return
    }

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        },
    })

    console.log(`[Stripe] Subscription updated for organization ${organizationId}`)
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const organizationId = subscription.metadata?.organizationId

    if (!organizationId) {
        console.error('[Stripe] Missing organizationId in subscription metadata')
        return
    }

    // Downgrade to FREE plan
    await prisma.subscription.update({
        where: { organizationId },
        data: {
            status: 'CANCELED',
            canceledAt: new Date(),
        },
    })

    await prisma.organization.update({
        where: { id: organizationId },
        data: {
            plan: 'FREE',
            maxUsers: 1,
            maxChannels: 1,
            maxContacts: 500,
            maxMessages: 1000,
        },
    })

    console.log(`[Stripe] Subscription canceled, downgraded to FREE for organization ${organizationId}`)
}

// Handle successful invoice payment
async function handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.subscription as string

    if (!subscriptionId) return

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const organizationId = subscription.metadata?.organizationId

    if (!organizationId) return

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            status: 'ACTIVE',
        },
    })

    console.log(`[Stripe] Invoice paid for organization ${organizationId}`)
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.subscription as string

    if (!subscriptionId) return

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const organizationId = subscription.metadata?.organizationId

    if (!organizationId) return

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            status: 'PAST_DUE',
        },
    })

    console.log(`[Stripe] Payment failed for organization ${organizationId}`)

    // Send email notification to organization owner
    await sendSubscriptionNotification(organizationId, 'payment_failed', {
        invoiceId: invoice.id,
        amountDue: invoice.amount_due / 100,
        currency: invoice.currency,
    })
}

// Send subscription-related email notifications via Resend
async function sendSubscriptionNotification(
    organizationId: string,
    type: 'payment_failed' | 'subscription_canceled' | 'subscription_updated',
    data?: Record<string, unknown>
) {
    try {
        // Get organization and owner email
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                name: true,
                billingEmail: true,
                users: {
                    where: { role: 'OWNER' },
                    select: { email: true, name: true },
                    take: 1,
                },
            },
        })

        if (!org) return

        const recipientEmail = org.billingEmail || org.users[0]?.email
        if (!recipientEmail) return

        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        const subjects: Record<string, string> = {
            payment_failed: `⚠️ Payment Failed - ${org.name}`,
            subscription_canceled: `Subscription Canceled - ${org.name}`,
            subscription_updated: `Subscription Updated - ${org.name}`,
        }

        const bodies: Record<string, string> = {
            payment_failed: `
Hello,

We were unable to process your payment for ${org.name}.

Amount Due: ${data?.currency?.toString().toUpperCase()} ${data?.amountDue}

Please update your payment method to avoid service interruption.

You can update your payment details at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'}/settings/billing

Best regards,
The WhatsApp CRM Team
            `.trim(),
            subscription_canceled: `
Hello,

Your subscription for ${org.name} has been canceled.

Your account has been downgraded to the Free plan with limited features.

If you'd like to resubscribe, visit: ${process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'}/settings/billing

Best regards,
The WhatsApp CRM Team
            `.trim(),
            subscription_updated: `
Hello,

Your subscription for ${org.name} has been updated.

View your subscription details at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'}/settings/billing

Best regards,
The WhatsApp CRM Team
            `.trim(),
        }

        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'notifications@resend.dev',
            to: recipientEmail,
            subject: subjects[type],
            text: bodies[type],
        })

        console.log(`[Stripe] Email notification sent to ${recipientEmail} for ${type}`)
    } catch (error) {
        console.error('[Stripe] Failed to send email notification:', error)
        // Don't throw - email failures shouldn't break webhook processing
    }
}

// Map Stripe subscription status to our enum
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID' {
    const statusMap: Record<Stripe.Subscription.Status, any> = {
        'active': 'ACTIVE',
        'trialing': 'TRIALING',
        'past_due': 'PAST_DUE',
        'canceled': 'CANCELED',
        'incomplete': 'INCOMPLETE',
        'incomplete_expired': 'INCOMPLETE_EXPIRED',
        'unpaid': 'UNPAID',
        'paused': 'CANCELED', // Map paused to canceled
    }

    return statusMap[stripeStatus] || 'CANCELED'
}
