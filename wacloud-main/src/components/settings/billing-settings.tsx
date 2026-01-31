'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Calendar, AlertCircle, Check, Zap } from 'lucide-react'
import { PLANS, PlanType } from '@/config/plans'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Subscription {
  plan: PlanType
  status: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
}

export function BillingSettings() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/billing/subscription')
      if (response.ok) {
        const data = await response.json()
        setSubscription(data.subscription)
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
      toast.error('Failed to load subscription details')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    setActionLoading(plan)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start checkout')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error) {
      console.error('Upgrade error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start upgrade')
      setActionLoading(null)
    }
  }

  const openBillingPortal = async () => {
    setActionLoading('portal')
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to open billing portal')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to open billing portal')
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentPlan = subscription?.plan || 'FREE'

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing & Subscription</h2>
        <p className="text-muted-foreground">
          Manage your subscription plan and payment details
        </p>
      </div>

      {/* Current Subscription Status */}
      <Card className="border-primary/20 bg-muted/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Current Plan: {PLANS[currentPlan]?.name}</CardTitle>
              <CardDescription>
                {subscription?.status === 'ACTIVE'
                  ? 'Your subscription is active'
                  : 'You are on the free tier'}
              </CardDescription>
            </div>
            {subscription?.status === 'ACTIVE' && (
              <Badge variant="default" className="bg-green-600">Active</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              {subscription?.currentPeriodEnd && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {subscription.cancelAtPeriodEnd ? 'Expires' : 'Renews'} on{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
              {subscription?.cancelAtPeriodEnd && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Scheduled for cancellation
                </p>
              )}
            </div>

            {currentPlan !== 'FREE' && (
              <Button
                variant="outline"
                onClick={openBillingPortal}
                disabled={!!actionLoading}
              >
                {actionLoading === 'portal' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Table */}
      <div>
        <h3 className="mb-4 text-xl font-semibold">Available Plans</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(PLANS) as [string, typeof PLANS.FREE][]).map(([key, plan]) => {
            const isCurrentPlan = key === currentPlan
            const isPopular = (plan as any).popular

            return (
              <Card
                key={key}
                className={cn(
                  "flex flex-col relative",
                  isCurrentPlan && "border-primary shadow-sm",
                  isPopular && !isCurrentPlan && "border-blue-500/50 shadow-md"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 hover:bg-blue-600">Most Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {isCurrentPlan && <Check className="h-5 w-5 text-primary" />}
                  </CardTitle>
                  <CardDescription>{(plan as any).description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : (isPopular ? "default" : "secondary")}
                    disabled={isCurrentPlan || !!actionLoading}
                    onClick={() => handleUpgrade(key)}
                  >
                    {actionLoading === key ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : (
                      <>
                        {key === 'FREE' ? 'Downgrade' : 'Upgrade'}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
