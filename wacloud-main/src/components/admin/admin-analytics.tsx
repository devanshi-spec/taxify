'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Building2, Users, DollarSign, TrendingUp, MessageSquare, Contact, Zap } from 'lucide-react'

interface Analytics {
    overview: {
        totalOrganizations: number
        activeSubscriptions: number
        totalUsers: number
        totalContacts: number
        mrr: number
        arr: number
    }
    usage: {
        currentMonth: {
            messages: number
            contacts: number
            aiTokens: number
        }
        lastMonth: {
            messages: number
            contacts: number
            aiTokens: number
        }
        growth: {
            messages: string
        }
    }
    plans: Array<{ plan: string; count: number }>
    recentOrganizations: Array<{
        id: string
        name: string
        plan: string
        createdAt: string
    }>
}

export function AdminAnalytics() {
    const [analytics, setAnalytics] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [])

    const fetchAnalytics = async () => {
        try {
            const response = await fetch('/api/admin/analytics')
            if (response.ok) {
                const data = await response.json()
                setAnalytics(data.data)
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
        return num.toString()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!analytics) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                Failed to load analytics
            </div>
        )
    }

    const stats = [
        {
            title: 'Total Organizations',
            value: analytics.overview.totalOrganizations,
            icon: Building2,
            color: 'text-blue-500',
        },
        {
            title: 'Active Subscriptions',
            value: analytics.overview.activeSubscriptions,
            icon: TrendingUp,
            color: 'text-green-500',
        },
        {
            title: 'Total Users',
            value: analytics.overview.totalUsers,
            icon: Users,
            color: 'text-purple-500',
        },
        {
            title: 'Total Contacts',
            value: formatNumber(analytics.overview.totalContacts),
            icon: Contact,
            color: 'text-orange-500',
        },
        {
            title: 'MRR',
            value: formatCurrency(analytics.overview.mrr),
            icon: DollarSign,
            color: 'text-emerald-500',
            subtitle: `ARR: ${formatCurrency(analytics.overview.arr)}`,
        },
        {
            title: 'Messages (This Month)',
            value: formatNumber(analytics.usage.currentMonth.messages),
            icon: MessageSquare,
            color: 'text-cyan-500',
            subtitle: `${analytics.usage.growth.messages}% vs last month`,
        },
    ]

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Card key={stat.title}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {stat.title}
                                </CardTitle>
                                <Icon className={`h-4 w-4 ${stat.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                                {stat.subtitle && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {stat.subtitle}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Plan Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Plan Distribution</CardTitle>
                    <CardDescription>Organizations by plan type</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {analytics.plans.map((plan) => {
                            const total = analytics.overview.totalOrganizations
                            const percentage = total > 0 ? (plan.count / total) * 100 : 0

                            return (
                                <div key={plan.plan} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{plan.plan}</Badge>
                                        <span className="text-sm text-muted-foreground">
                                            {plan.count} organizations
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium">
                                        {percentage.toFixed(1)}%
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Recent Organizations */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Organizations</CardTitle>
                    <CardDescription>Latest signups</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {analytics.recentOrganizations.map((org) => (
                            <div key={org.id} className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{org.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(org.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <Badge>{org.plan}</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Usage Metrics */}
            <Card>
                <CardHeader>
                    <CardTitle>Platform Usage</CardTitle>
                    <CardDescription>Current month vs last month</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Messages</span>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">
                                    Last: {formatNumber(analytics.usage.lastMonth.messages)}
                                </span>
                                <span className="text-sm font-bold">
                                    Current: {formatNumber(analytics.usage.currentMonth.messages)}
                                </span>
                                <Badge variant={parseFloat(analytics.usage.growth.messages) >= 0 ? 'default' : 'destructive'}>
                                    {analytics.usage.growth.messages}%
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">AI Tokens</span>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">
                                    Last: {formatNumber(analytics.usage.lastMonth.aiTokens)}
                                </span>
                                <span className="text-sm font-bold">
                                    Current: {formatNumber(analytics.usage.currentMonth.aiTokens)}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
