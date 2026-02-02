export const PLANS = {
    FREE: {
        name: 'Free',
        price: 0,
        priceId: null,
        description: 'Perfect for testing and small teams',
        limits: {
            maxUsers: 1,
            maxChannels: 1,
            maxContacts: 500,
            maxMessages: 1000,
        },
        features: [
            'Up to 1,000 messages/month',
            '500 contacts',
            '1 WhatsApp channel',
            'Basic chatbot',
            'Email support',
        ],
    },
    STARTER: {
        name: 'Starter',
        price: 29,
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
        description: 'For growing businesses',
        popular: true,
        limits: {
            maxUsers: 3,
            maxChannels: 2,
            maxContacts: 5000,
            maxMessages: 10000,
        },
        features: [
            'Up to 10,000 messages/month',
            '5,000 contacts',
            '2 channels (WhatsApp + Instagram)',
            'Advanced chatbot with AI',
            'Drip campaigns',
            'Basic analytics',
            'Priority email support',
        ],
    },
    PROFESSIONAL: {
        name: 'Professional',
        price: 99,
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL,
        description: 'For established agencies',
        limits: {
            maxUsers: 10,
            maxChannels: 5,
            maxContacts: 50000,
            maxMessages: 100000,
        },
        features: [
            'Up to 100,000 messages/month',
            '50,000 contacts',
            '5 channels',
            'AI chatbot with custom models',
            'Advanced drip campaigns',
            'WhatsApp Flows',
            'Full analytics & reporting',
            'CRM & Deals pipeline',
            'API access',
            'Priority support',
        ],
    },
    ENTERPRISE: {
        name: 'Enterprise',
        price: 299,
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
        description: 'For high-volume needs',
        limits: {
            maxUsers: 999,
            maxChannels: 999,
            maxContacts: 999999,
            maxMessages: 999999,
        },
        features: [
            'Unlimited messages',
            'Unlimited contacts',
            'Unlimited channels',
            'Custom AI models',
            'White-label options',
            'Advanced automation',
            'Dedicated account manager',
            '24/7 phone support',
            'SLA guarantee',
            'Custom integrations',
        ],
    },
} as const

export type PlanType = keyof typeof PLANS

export function getPlanConfig(plan: PlanType) {
    return PLANS[plan]
}
