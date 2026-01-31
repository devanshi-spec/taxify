'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    MousePointerClick,
    Users,
    TrendingUp,
    DollarSign,
    Target,
    BarChart3,
    Loader2,
    Facebook,
    Sparkles,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface AttributionData {
    overview: {
        totalContacts: number
        ctwaContacts: number
        organicContacts: number
        apiContacts: number
        ctwaPercentage: number
    }
    attribution: {
        contactsFromAds: number
        contactsConverted: number
        conversionRate: number
        totalRevenue: number
        avgDealValue: number
    }
    campaigns: Array<{ campaign: string; contacts: number }>
    sourceBreakdown: Array<{ source: string; count: number; percentage: number }>
    period: string
}

export function CTWAAttribution() {
    const [period, setPeriod] = useState('30d')
    const [data, setData] = useState<AttributionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchAttribution()
    }, [period])

    const fetchAttribution = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(`/api/analytics/attribution?period=${period}`)

            if (!response.ok) {
                throw new Error('Failed to fetch attribution data')
            }

            const result = await response.json()
            setData(result.data)
        } catch (err) {
            console.error('Error fetching attribution:', err)
            setError(err instanceof Error ? err.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-sm text-red-500">{error}</p>
            </div>
        )
    }

    if (!data) return null

    const sourceColors: Record<string, string> = {
        ctwa: 'bg-blue-500',
        organic: 'bg-green-500',
        api: 'bg-violet-500',
        import: 'bg-amber-500',
        unknown: 'bg-gray-400',
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <MousePointerClick className="h-6 w-6" />
                        Click-to-WhatsApp Attribution
                    </h2>
                    <p className="text-muted-foreground">
                        Track ROI from your WhatsApp ad campaigns
                    </p>
                </div>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Overview Stats */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.overview.totalContacts}</div>
                        <p className="text-xs text-muted-foreground">new contacts</p>
                    </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">From Ads</CardTitle>
                        <Facebook className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{data.overview.ctwaContacts}</div>
                        <p className="text-xs text-muted-foreground">{data.overview.ctwaPercentage}% of total</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Converted</CardTitle>
                        <Target className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.attribution.contactsConverted}</div>
                        <p className="text-xs text-muted-foreground">{data.attribution.conversionRate}% rate</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.attribution.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">from ad leads</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Avg Deal</CardTitle>
                        <TrendingUp className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.attribution.avgDealValue)}</div>
                        <p className="text-xs text-muted-foreground">per conversion</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Source Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Traffic Sources
                        </CardTitle>
                        <CardDescription>
                            Where your contacts are coming from
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            {data.sourceBreakdown.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.sourceBreakdown}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="count"
                                        >
                                            {data.sourceBreakdown.map((entry, index) => {
                                                const colorClass = sourceColors[entry.source] || 'bg-gray-400'
                                                // Extract color hex from Tailwind class if possible, or use standard palette
                                                // Simplified mapping for Pie Chart cells
                                                const colors: Record<string, string> = {
                                                    ctwa: '#3b82f6', // blue-500
                                                    organic: '#22c55e', // green-500
                                                    api: '#8b5cf6', // violet-500
                                                    import: '#f59e0b', // amber-500
                                                    unknown: '#9ca3af', // gray-400
                                                }
                                                return <Cell key={`cell-${index}`} fill={colors[entry.source] || '#9ca3af'} />
                                            })}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: any) => [`${value} contacts`, 'Count']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center">
                                    No data available
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Campaigns */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            Top Ad Campaigns
                        </CardTitle>
                        <CardDescription>
                            Best performing campaigns by lead volume
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.campaigns.length > 0 ? (
                                data.campaigns.map((campaign, index) => (
                                    <div key={campaign.campaign} className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-bold dark:bg-blue-900/50">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{campaign.campaign}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {campaign.contacts} leads generated
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <Facebook className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        No ad campaign data yet
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Run Click-to-WhatsApp ads on Facebook/Instagram to see attribution here
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Setup Guide */}
            {data.overview.ctwaContacts === 0 && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <MousePointerClick className="h-4 w-4 text-amber-600" />
                            Setup Click-to-WhatsApp Attribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                        <p>
                            To track leads from your WhatsApp ads, make sure your webhook captures the <code className="bg-muted px-1 rounded">ctwa_clid</code> parameter from Meta.
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                            <li>Create a Click-to-WhatsApp ad in Meta Ads Manager</li>
                            <li>The ad will include a tracking parameter when users click</li>
                            <li>Our webhook automatically captures and stores this data</li>
                            <li>View ROI and conversion metrics here</li>
                        </ol>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
