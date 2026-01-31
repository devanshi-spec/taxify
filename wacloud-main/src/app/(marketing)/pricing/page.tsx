'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Zap } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const plans = [
    {
        name: 'Free',
        price: 0,
        description: 'Perfect for trying out the platform',
        features: [
            'Up to 1,000 messages/month',
            '500 contacts',
            '1 WhatsApp channel',
            'Basic chatbot',
            'Email support',
        ],
        cta: 'Get Started',
        popular: false,
        plan: 'FREE' as const,
    },
    {
        name: 'Starter',
        price: 29,
        description: 'Great for small businesses',
        features: [
            'Up to 10,000 messages/month',
            '5,000 contacts',
            '2 channels (WhatsApp + Instagram)',
            'Advanced chatbot with AI',
            'Drip campaigns',
            'Basic analytics',
            'Priority email support',
            '14-day free trial',
        ],
        cta: 'Start Free Trial',
        popular: true,
        plan: 'STARTER' as const,
    },
    {
        name: 'Professional',
        price: 99,
        description: 'For growing teams',
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
            '14-day free trial',
        ],
        cta: 'Start Free Trial',
        popular: false,
        plan: 'PROFESSIONAL' as const,
    },
    {
        name: 'Enterprise',
        price: 299,
        description: 'For large organizations',
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
        cta: 'Contact Sales',
        popular: false,
        plan: 'ENTERPRISE' as const,
    },
]

export default function PricingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)

    const handleSubscribe = async (plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') => {
        setLoading(plan)

        try {
            const response = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create checkout session')
            }

            const { url } = await response.json()

            if (!url) {
                throw new Error('No checkout URL returned')
            }

            // Redirect to Stripe checkout
            window.location.href = url
        } catch (error) {
            console.error('Error:', error)
            alert(error instanceof Error ? error.message : 'Failed to start checkout')
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <Zap className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="text-xl font-bold">WhatsApp CRM</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost">Sign In</Button>
                        </Link>
                        <Link href="/register">
                            <Button>Get Started</Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Hero */}
            <div className="container py-16 text-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                    Simple, Transparent Pricing
                </h1>
                <p className="mt-4 text-xl text-muted-foreground">
                    Choose the perfect plan for your business. All plans include a 14-day free trial.
                </p>
            </div>

            {/* Pricing Cards */}
            <div className="container pb-16">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                    {plans.map((plan) => (
                        <Card
                            key={plan.name}
                            className={`relative flex flex-col ${plan.popular ? 'border-primary shadow-lg' : ''
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                    <Badge className="px-4 py-1">Most Popular</Badge>
                                </div>
                            )}

                            <CardHeader>
                                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                                <div className="mt-4">
                                    <span className="text-4xl font-bold">${plan.price}</span>
                                    <span className="text-muted-foreground">/month</span>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1">
                                <ul className="space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2">
                                            <Check className="h-5 w-5 shrink-0 text-primary" />
                                            <span className="text-sm">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter>
                                {plan.plan === 'FREE' ? (
                                    <Link href="/register" className="w-full">
                                        <Button variant="outline" className="w-full">
                                            {plan.cta}
                                        </Button>
                                    </Link>
                                ) : plan.plan === 'ENTERPRISE' ? (
                                    <Link href="mailto:sales@example.com" className="w-full">
                                        <Button variant={plan.popular ? 'default' : 'outline'} className="w-full">
                                            {plan.cta}
                                        </Button>
                                    </Link>
                                ) : (
                                    <Button
                                        variant={plan.popular ? 'default' : 'outline'}
                                        className="w-full"
                                        onClick={() => handleSubscribe(plan.plan as 'STARTER' | 'PROFESSIONAL')}
                                        disabled={loading !== null}
                                    >
                                        {loading === plan.plan ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            plan.cta
                                        )}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>

            {/* FAQ */}
            <div className="border-t bg-background/50 py-16">
                <div className="container">
                    <h2 className="text-center text-3xl font-bold">Frequently Asked Questions</h2>
                    <div className="mx-auto mt-8 max-w-3xl space-y-6">
                        <div>
                            <h3 className="font-semibold">Can I change plans later?</h3>
                            <p className="mt-2 text-muted-foreground">
                                Yes! You can upgrade or downgrade your plan at any time. Changes will be prorated.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-semibold">What happens after the free trial?</h3>
                            <p className="mt-2 text-muted-foreground">
                                After 14 days, you'll be automatically charged for your selected plan. You can cancel anytime during the trial.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-semibold">Do you offer refunds?</h3>
                            <p className="mt-2 text-muted-foreground">
                                Yes, we offer a 30-day money-back guarantee. No questions asked.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-semibold">What payment methods do you accept?</h3>
                            <p className="mt-2 text-muted-foreground">
                                We accept all major credit cards (Visa, Mastercard, American Express) via Stripe.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t py-8">
                <div className="container text-center text-sm text-muted-foreground">
                    <p>© 2026 WhatsApp CRM. All rights reserved.</p>
                </div>
            </div>
        </div>
    )
}
