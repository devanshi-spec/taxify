'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Users,
    MessageSquare,
    Clock,
    CheckCircle2,
    TrendingUp,
    Trophy,
    Loader2,
    ArrowUpRight,
    Target,
} from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'

interface AgentMetrics {
    agent: {
        id: string
        name: string
        email: string
        avatarUrl: string | null
        role: string
    }
    metrics: {
        assignedConversations: number
        resolvedConversations: number
        resolutionRate: number
        messagesSent: number
        avgResponseTime: number
        avgResponseTimeFormatted: string
        firstResponseTime: number
        firstResponseTimeFormatted: string
    }
}

interface PerformanceData {
    agents: AgentMetrics[]
    teamTotals: {
        totalAssigned: number
        totalResolved: number
        totalMessages: number
        avgResolutionRate: number
    }
    leaderboard: AgentMetrics[]
    period: string
}

export function AgentPerformance() {
    const [period, setPeriod] = useState('7d')
    const [data, setData] = useState<PerformanceData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchPerformance()
    }, [period])

    const fetchPerformance = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(`/api/analytics/agent-performance?period=${period}`)

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('You do not have permission to view agent performance')
                }
                throw new Error('Failed to fetch agent performance')
            }

            const result = await response.json()
            setData(result.data)
        } catch (err) {
            console.error('Error fetching agent performance:', err)
            setError(err instanceof Error ? err.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        Agent Performance
                    </h2>
                    <p className="text-muted-foreground">
                        Track team productivity and response times
                    </p>
                </div>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Team Totals */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.teamTotals.totalAssigned}</div>
                        <p className="text-xs text-muted-foreground">conversations</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.teamTotals.totalResolved}</div>
                        <p className="text-xs text-muted-foreground">conversations closed</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.teamTotals.totalMessages}</div>
                        <p className="text-xs text-muted-foreground">outbound messages</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
                        <Target className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.teamTotals.avgResolutionRate}%</div>
                        <Progress value={data.teamTotals.avgResolutionRate} className="mt-2 h-1" />
                    </CardContent>
                </Card>

            </div>

            {/* Agent Performance Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Conversation Handling by Agent</CardTitle>
                    <CardDescription>Comparison of assigned vs resolved conversations per agent</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data.agents.map(a => ({
                                    name: a.agent.name.split(' ')[0], // First name only for clearer labels
                                    assigned: a.metrics.assignedConversations,
                                    resolved: a.metrics.resolvedConversations
                                }))}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="assigned" name="Assigned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Leaderboard */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Top Performers
                        </CardTitle>
                        <CardDescription>
                            Agents with most resolutions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.leaderboard.map((item, index) => (
                                <div key={item.agent.id} className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                                        {index + 1}
                                    </div>
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={item.agent.avatarUrl || undefined} />
                                        <AvatarFallback>
                                            {item.agent.name?.charAt(0) || item.agent.email.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.agent.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.metrics.resolvedConversations} resolved
                                        </p>
                                    </div>
                                    <Badge variant="secondary">
                                        {item.metrics.resolutionRate}%
                                    </Badge>
                                </div>
                            ))}
                            {data.leaderboard.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No data available
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Agent Table */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Agent Metrics
                        </CardTitle>
                        <CardDescription>
                            Detailed performance breakdown
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="text-right">Assigned</TableHead>
                                    <TableHead className="text-right">Resolved</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">Avg FRT</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.agents.map((item) => (
                                    <TableRow key={item.agent.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={item.agent.avatarUrl || undefined} />
                                                    <AvatarFallback>
                                                        {item.agent.name?.charAt(0) || item.agent.email.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{item.agent.name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.agent.role}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.metrics.assignedConversations}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.metrics.resolvedConversations}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge
                                                variant={item.metrics.resolutionRate >= 80 ? 'default' : 'secondary'}
                                                className={item.metrics.resolutionRate >= 80 ? 'bg-green-500' : ''}
                                            >
                                                {item.metrics.resolutionRate}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="flex items-center justify-end gap-1">
                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                {item.metrics.firstResponseTimeFormatted}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.agents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No agents found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Response Time Benchmarks */}
            <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20">
                <CardHeader>
                    <CardTitle className="text-base">Industry Benchmarks</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">First Response Time</p>
                            <p className="font-semibold">Target: &lt; 5 minutes</p>
                            <p className="text-xs text-green-600">WhatsApp customers expect fast replies</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Resolution Rate</p>
                            <p className="font-semibold">Target: &gt; 80%</p>
                            <p className="text-xs text-green-600">Industry average is 75-85%</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Messages per Resolution</p>
                            <p className="font-semibold">Target: &lt; 10 messages</p>
                            <p className="text-xs text-green-600">Efficient resolutions = happy customers</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">CSAT Score</p>
                            <p className="font-semibold">Target: &gt; 4.5/5</p>
                            <p className="text-xs text-muted-foreground">Coming soon: Post-chat surveys</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div >
    )
}
