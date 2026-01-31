'use client'

import { useEffect, useState } from 'react'
import {
  MessageSquare,
  Users,
  Send,
  TrendingUp,
  Bot,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'

interface AnalyticsData {
  stats: {
    totalMessages: number
    messagesChange: number
    activeConversations: number
    conversationsChange: number
    totalContacts: number
    contactsChange: number
    aiResponses: number
    aiResponseRate: number
    deliveryRate: number
    readRate: number
  }
  topChannels: Array<{
    id: string
    name: string
    messages: number
    percentage: number
    status: string
  }>
  recentActivity: Array<{
    type: string
    text: string
    preview: string
    time: string
  }>
  messageVolume: Array<{
    date: string
    inbound: number
    outbound: number
  }>
  period: string
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  suffix = '',
  loading = false,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ComponentType<{ className?: string }>
  suffix?: string
  loading?: boolean
}) {
  const isPositive = change !== undefined && change >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <div className="text-2xl font-bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {suffix}
            </div>
            {change !== undefined && (
              <p
                className={`mt-1 flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3" />
                )}
                {Math.abs(change)}% from last period
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/analytics?period=${period}`)

      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const stats = data?.stats || {
    totalMessages: 0,
    messagesChange: 0,
    activeConversations: 0,
    conversationsChange: 0,
    totalContacts: 0,
    contactsChange: 0,
    aiResponses: 0,
    aiResponseRate: 0,
    deliveryRate: 0,
    readRate: 0,
  }

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex justify-between items-center">
        <div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
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

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Messages"
          value={stats.totalMessages}
          change={stats.messagesChange}
          icon={MessageSquare}
          loading={loading}
        />
        <StatCard
          title="Active Conversations"
          value={stats.activeConversations}
          change={stats.conversationsChange}
          icon={Send}
          loading={loading}
        />
        <StatCard
          title="Total Contacts"
          value={stats.totalContacts}
          change={stats.contactsChange}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="AI Responses"
          value={stats.aiResponses}
          icon={Bot}
          loading={loading}
        />
      </div>

      {/* Second row stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="AI Response Rate"
          value={stats.aiResponseRate}
          icon={TrendingUp}
          suffix="%"
          loading={loading}
        />
        <StatCard
          title="Delivery Rate"
          value={stats.deliveryRate}
          icon={CheckCircle}
          suffix="%"
          loading={loading}
        />
        <StatCard
          title="Read Rate"
          value={stats.readRate}
          icon={MessageSquare}
          suffix="%"
          loading={loading}
        />
        <StatCard
          title="Response Rate"
          value={stats.aiResponseRate}
          icon={TrendingUp}
          suffix="%"
          loading={loading}
        />
      </div>

      {/* Charts and activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Channels</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : data?.topChannels && data.topChannels.length > 0 ? (
              <div className="space-y-4">
                {data.topChannels.map((channel) => (
                  <div key={channel.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{channel.name}</span>
                      <span className="text-muted-foreground">
                        {channel.messages.toLocaleString()} messages
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${channel.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No channel data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {data.recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message volume chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message Volume</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : data?.messageVolume && data.messageVolume.length > 0 ? (
            <div className="h-[300px]">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.messageVolume} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    />
                    <Legend />
                    <Bar dataKey="inbound" name="Inbound" fill="#3b82f6" stackId="a" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="outbound" name="Outbound" fill="#22c55e" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-lg border-2 border-dashed">
              <div className="text-center">
                <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No message data available for this period
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
