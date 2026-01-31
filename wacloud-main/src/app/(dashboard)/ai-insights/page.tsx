'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Brain,
    Zap,
    DollarSign,
    Activity,
    BarChart,
    LineChart,
    PieChart,
    Loader2,
    Cpu,
    Bot,
    MessageSquare,
    User
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function AIInsightsPage() {
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('30')
    const [data, setData] = useState<any>(null)
    const [userProfile, setUserProfile] = useState<any>(null)

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserProfile({
                    name: user.user_metadata?.name,
                    email: user.email,
                    avatarUrl: user.user_metadata?.avatar_url,
                })
            }
        }
        fetchUser()
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const response = await fetch(`/api/ai/analytics?days=${period}`)
                if (response.ok) {
                    const result = await response.json()
                    setData(result.data)
                }
            } catch (error) {
                console.error('Failed to fetch AI analytics', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [period])

    if (loading && !data) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex h-screen flex-col bg-slate-50">
            <Header user={userProfile} title="AI Insights" />

            <div className="flex-1 overflow-auto p-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">AI Performance</h2>
                        <p className="text-muted-foreground mt-1">
                            Monitor usage, costs, and effectiveness of AI features across your CRM
                        </p>
                    </div>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 3 months</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Overview Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(data?.stats.totalCost || 0)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {((data?.budget.percentageUsed || 0) as number).toFixed(1)}% of monthly budget
                            </p>
                            <div className="mt-3 h-2 w-full rounded-full bg-secondary">
                                <div
                                    className="h-2 rounded-full bg-primary"
                                    style={{ width: `${Math.min(data?.budget.percentageUsed || 0, 100)}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Requests</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data?.stats.requestCount || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Total AI interactions
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {((data?.stats.totalTokens || 0) / 1000).toFixed(1)}k
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Avg {(data?.stats.totalTokens / (data?.stats.requestCount || 1)).toFixed(0)} per request
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {(data?.stats.successRate || 0).toFixed(1)}%
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Avg latency {(data?.stats.avgLatency || 0).toFixed(0)}ms
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="usage">Usage Trends</TabsTrigger>
                        <TabsTrigger value="models">Models & Features</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            {/* Cost Trend Chart */}
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle>Usage Cost Trend</CardTitle>
                                    <CardDescription>
                                        Daily AI implementation cost over time
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pl-2">
                                    <div className="h-[300px] w-full">
                                        {data?.trends && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={data.trends}>
                                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                                    <XAxis
                                                        dataKey="date"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    />
                                                    <YAxis
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value: number) => `$${value}`}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: number | string | Array<number | string> | undefined) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
                                                        labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="cost"
                                                        stroke="#8884d8"
                                                        fill="#8884d8"
                                                        fillOpacity={0.2}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Feature Usage Chart */}
                            <Card className="col-span-3">
                                <CardHeader>
                                    <CardTitle>Usage by Feature</CardTitle>
                                    <CardDescription>
                                        Where AI is being used most
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {Object.entries(data?.stats.byFeature || {}).map(([feature, stats]: [string, any]) => (
                                            <div key={feature} className="flex items-center">
                                                <div className="flex items-center gap-2 w-[140px] shrink-0">
                                                    {feature === 'bot-flow' && <Bot className="h-4 w-4 text-blue-500" />}
                                                    {feature === 'chat-response' && <MessageSquare className="h-4 w-4 text-green-500" />}
                                                    {feature.includes('contact') && <User className="h-4 w-4 text-purple-500" />}
                                                    <span className="text-sm font-medium capitalize truncate" title={feature}>
                                                        {feature.replace(/-/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="flex-1 mx-2 h-2 rounded-full bg-secondary overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary"
                                                        style={{ width: `${(stats.requests / data.stats.requestCount) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="w-[60px] text-right text-sm text-muted-foreground">
                                                    {stats.requests}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="usage" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Token Usage Volume</CardTitle>
                                <CardDescription>
                                    Total input and output tokens processed daily
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <div className="h-[400px] w-full">
                                    {data?.trends && (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsBarChart data={data.trends}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                                <XAxis
                                                    dataKey="date"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                />
                                                <YAxis
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <Tooltip
                                                    labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                                                />
                                                <Bar dataKey="tokens" fill="#adfa1d" radius={[4, 4, 0, 0]} name="Total Tokens" />
                                            </RechartsBarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="models" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Model Distribution</CardTitle>
                                    <CardDescription>Cost breakdown by AI Model</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {Object.entries(data?.stats.byModel || {}).map(([model, stats]: [string, any]) => (
                                            <div key={model} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <p className="font-medium">{model}</p>
                                                    <p className="text-xs text-muted-foreground">{stats.requests} requests</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold">{formatCurrency(stats.cost)}</p>
                                                    <p className="text-xs text-muted-foreground">{(stats.tokens / 1000).toFixed(1)}k tokens</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
