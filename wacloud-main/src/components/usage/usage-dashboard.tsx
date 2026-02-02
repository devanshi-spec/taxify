'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp, Users, MessageSquare, Contact, Zap, HardDrive, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface UsageStats {
    plan: string
    users: { current: number; limit: number; percentage: number }
    channels: { current: number; limit: number; percentage: number }
    contacts: { current: number; limit: number; percentage: number }
    messages: { current: number; limit: number; percentage: number }
    aiTokens: { current: number; limit: number; percentage: number }
    storage: { current: number; limit: number; percentage: number }
    upgradePrompt: { show: boolean; reason?: string }
}

export function UsageDashboard() {
    const [stats, setStats] = useState<UsageStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/usage/stats')
            if (response.ok) {
                const data = await response.json()
                setStats(data.data)
            }
        } catch (error) {
            console.error('Failed to fetch usage stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return 'bg-red-500'
        if (percentage >= 80) return 'bg-yellow-500'
        return 'bg-primary'
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

    if (!stats) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                Failed to load usage statistics
            </div>
        )
    }

    const usageItems = [
        {
            icon: Users,
            label: 'Team Members',
            ...stats.users,
            color: 'text-blue-500',
        },
        {
            icon: MessageSquare,
            label: 'Messages (This Month)',
            ...stats.messages,
            color: 'text-green-500',
        },
        {
            icon: Contact,
            label: 'Contacts',
            ...stats.contacts,
            color: 'text-purple-500',
        },
        {
            icon: Zap,
            label: 'Channels',
            ...stats.channels,
            color: 'text-orange-500',
        },
        {
            icon: TrendingUp,
            label: 'AI Tokens (This Month)',
            ...stats.aiTokens,
            color: 'text-pink-500',
        },
        {
            icon: HardDrive,
            label: 'Storage',
            ...stats.storage,
            color: 'text-cyan-500',
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Usage & Limits</h2>
                    <p className="text-muted-foreground">
                        Monitor your plan usage and limits
                    </p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                    {stats.plan} Plan
                </Badge>
            </div>

            {/* Upgrade Prompt */}
            {stats.upgradePrompt.show && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                                    Approaching Limit
                                </h3>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    {stats.upgradePrompt.reason}
                                </p>
                                <Link href="/pricing" className="mt-3 inline-block">
                                    <Button size="sm" variant="default">
                                        Upgrade Plan
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Usage Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {usageItems.map((item) => {
                    const Icon = item.icon
                    const isNearLimit = item.percentage >= 80
                    const isAtLimit = item.percentage >= 100

                    return (
                        <Card key={item.label} className={isAtLimit ? 'border-red-500' : ''}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {item.label}
                                </CardTitle>
                                <Icon className={`h-4 w-4 ${item.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-baseline justify-between">
                                        <div className="text-2xl font-bold">
                                            {formatNumber(item.current)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            of {formatNumber(item.limit)}
                                        </div>
                                    </div>

                                    <Progress
                                        value={Math.min(item.percentage, 100)}
                                        className="h-2"
                                        indicatorClassName={getProgressColor(item.percentage)}
                                    />

                                    <div className="flex items-center justify-between text-xs">
                                        <span className={isNearLimit ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-muted-foreground'}>
                                            {item.percentage.toFixed(0)}% used
                                        </span>
                                        {isAtLimit && (
                                            <span className="text-red-600 dark:text-red-400 font-medium">
                                                Limit reached
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Plan Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Plan Details</CardTitle>
                    <CardDescription>
                        Your current plan limits and features
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Plan:</span>
                            <span className="font-medium">{stats.plan}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Team Members:</span>
                            <span className="font-medium">{stats.users.limit} max</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Monthly Messages:</span>
                            <span className="font-medium">{formatNumber(stats.messages.limit)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Contacts:</span>
                            <span className="font-medium">{formatNumber(stats.contacts.limit)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Channels:</span>
                            <span className="font-medium">{stats.channels.limit}</span>
                        </div>
                    </div>

                    {stats.plan === 'FREE' && (
                        <div className="mt-4 pt-4 border-t">
                            <Link href="/pricing">
                                <Button className="w-full">
                                    Upgrade to unlock more features
                                </Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
