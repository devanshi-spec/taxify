'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    BarChart3,
    Send,
    CheckCircle2,
    Eye,
    MessageCircle,
    XCircle,
    TrendingUp,
    Users,
    Loader2,
    ArrowLeft
} from 'lucide-react'
import { format } from 'date-fns'

interface CampaignStats {
    total: number
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
}

interface Campaign {
    id: string
    name: string
    status: string
    startedAt: string | null
    completedAt: string | null
}

interface CampaignAnalyticsProps {
    campaignId: string
    onBack?: () => void
}

export function CampaignAnalytics({ campaignId, onBack }: CampaignAnalyticsProps) {
    const [loading, setLoading] = useState(true)
    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [stats, setStats] = useState<CampaignStats | null>(null)

    useEffect(() => {
        async function fetchStats() {
            try {
                setLoading(true)
                const response = await fetch(`/api/campaigns/${campaignId}/execute`)
                if (response.ok) {
                    const result = await response.json()
                    setCampaign(result.data.campaign)
                    setStats(result.data.stats)
                }
            } catch (error) {
                console.error('Error fetching campaign stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [campaignId])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!campaign || !stats) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Campaign not found
            </div>
        )
    }

    const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : 0
    const openRate = stats.delivered > 0 ? ((stats.read / stats.delivered) * 100).toFixed(1) : 0
    const replyRate = stats.read > 0 ? ((stats.replied / stats.read) * 100).toFixed(1) : 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <div>
                    <h2 className="text-2xl font-bold">{campaign.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant={campaign.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {campaign.status}
                        </Badge>
                        {campaign.completedAt && (
                            <span className="text-sm text-muted-foreground">
                                Completed {format(new Date(campaign.completedAt), 'MMM d, yyyy h:mm a')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">contacts targeted</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sent</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.sent.toLocaleString()}</div>
                        <Progress value={stats.total > 0 ? (stats.sent / stats.total) * 100 : 0} className="mt-2 h-1" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.delivered.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{deliveryRate}% delivery rate</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.failed.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.sent > 0 ? ((stats.failed / stats.sent) * 100).toFixed(1) : 0}% failure rate
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Engagement Metrics */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Engagement Metrics
                    </CardTitle>
                    <CardDescription>
                        How recipients interacted with your campaign
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-3">
                        {/* Open Rate */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm font-medium">Read Rate</span>
                                </div>
                                <span className="text-sm font-bold">{openRate}%</span>
                            </div>
                            <Progress value={Number(openRate)} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                                {stats.read.toLocaleString()} of {stats.delivered.toLocaleString()} delivered
                            </p>
                        </div>

                        {/* Reply Rate */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-sm font-medium">Reply Rate</span>
                                </div>
                                <span className="text-sm font-bold">{replyRate}%</span>
                            </div>
                            <Progress value={Number(replyRate)} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                                {stats.replied.toLocaleString()} replies received
                            </p>
                        </div>

                        {/* Conversion Funnel */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-violet-500" />
                                <span className="text-sm font-medium">Conversion Funnel</span>
                            </div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span>Sent → Delivered</span>
                                    <span className="font-medium">{deliveryRate}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Delivered → Read</span>
                                    <span className="font-medium">{openRate}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Read → Replied</span>
                                    <span className="font-medium">{replyRate}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Industry Benchmarks */}
            <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-violet-600" />
                        Industry Benchmarks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                            <p className="text-muted-foreground">WhatsApp Delivery Rate</p>
                            <p className="font-semibold">Industry Avg: 95%+</p>
                            <p className={`text-xs ${Number(deliveryRate) >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
                                You: {deliveryRate}% {Number(deliveryRate) >= 95 ? '✓ Above average' : '⚠ Below average'}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">WhatsApp Read Rate</p>
                            <p className="font-semibold">Industry Avg: 90%+</p>
                            <p className={`text-xs ${Number(openRate) >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
                                You: {openRate}% {Number(openRate) >= 90 ? '✓ Above average' : '⚠ Below average'}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">WhatsApp Reply Rate</p>
                            <p className="font-semibold">Industry Avg: 15-25%</p>
                            <p className={`text-xs ${Number(replyRate) >= 15 ? 'text-green-600' : 'text-amber-600'}`}>
                                You: {replyRate}% {Number(replyRate) >= 15 ? '✓ Above average' : '⚠ Below average'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
