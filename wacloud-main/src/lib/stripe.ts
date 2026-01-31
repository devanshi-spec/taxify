import Stripe from 'stripe'
import { PLANS, PlanType } from '@/config/plans'

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
    typescript: true,
})

export const STRIPE_PLANS = PLANS
export type { PlanType }
export { getPlanConfig } from '@/config/plans'

// Helper to create checkout session
export async function createCheckoutSession({
    organizationId,
    plan,
    successUrl,
    cancelUrl,
}: {
    organizationId: string
    plan: PlanType
    successUrl: string
    cancelUrl: string
}) {
    const planConfig = STRIPE_PLANS[plan]

    if (!planConfig.priceId) {
        throw new Error(`Plan ${plan} does not have a Stripe price ID`)
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: planConfig.priceId,
                quantity: 1,
            },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: organizationId,
        metadata: {
            organizationId,
            plan,
        },
        subscription_data: {
            trial_period_days: 14, // 14-day free trial
            metadata: {
                organizationId,
                plan,
            },
        },
    })

    return session
}

// Helper to create billing portal session
export async function createBillingPortalSession({
    customerId,
    returnUrl,
}: {
    customerId: string
    returnUrl: string
}) {
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    })

    return session
}

// Helper to get subscription
export async function getSubscription(subscriptionId: string) {
    return await stripe.subscriptions.retrieve(subscriptionId)
}

// Helper to cancel subscription
export async function cancelSubscription(subscriptionId: string) {
    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
    })
}

// Helper to reactivate subscription
export async function reactivateSubscription(subscriptionId: string) {
    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
    })
}
