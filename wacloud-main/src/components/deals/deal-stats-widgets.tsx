'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trophy,
  XCircle,
  Target,
  Users,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DealStatsWidgetsProps {
  pipelineId: string
}

interface StatsData {
  totalPipelineValue: number
  openDeals: number
  wonThisMonth: {
    count: number
    value: number
  }
  lostThisMonth: {
    count: number
    value: number
  }
  conversionRate: number
  avgDealValue: number
  avgDaysToClose: number
  myDeals: number
  teamDeals: number
  stageDistribution: Array<{
    stage: string
    stageName: string
    count: number
    value: number
    color: string
  }>
}

export function DealStatsWidgets({ pipelineId }: DealStatsWidgetsProps) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/deals/stats?pipelineId=${pipelineId}`)
      if (response.ok) {
        const result = await response.json()
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error fetching deal stats:', error)
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const widgets = [
    {
      title: 'Pipeline Value',
      value: formatCurrency(stats.totalPipelineValue),
      subtitle: `${stats.openDeals} open deals`,
      icon: DollarSign,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      title: 'Won This Month',
      value: formatCurrency(stats.wonThisMonth.value),
      subtitle: `${stats.wonThisMonth.count} deals closed`,
      icon: Trophy,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
      trend: stats.wonThisMonth.count > 0 ? 'up' : undefined,
    },
    {
      title: 'Lost This Month',
      value: formatCurrency(stats.lostThisMonth.value),
      subtitle: `${stats.lostThisMonth.count} deals lost`,
      icon: XCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      trend: stats.lostThisMonth.count > 0 ? 'down' : undefined,
    },
    {
      title: 'Conversion Rate',
      value: `${stats.conversionRate.toFixed(1)}%`,
      subtitle: `Avg ${stats.avgDaysToClose.toFixed(0)} days to close`,
      icon: Target,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
  ]

  return (
    <div className="space-y-6 mb-6">
      {/* Main Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {widgets.map((widget) => {
          const Icon = widget.icon
          return (
            <Card key={widget.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {widget.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', widget.iconBg)}>
                  <Icon className={cn('h-4 w-4', widget.iconColor)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">{widget.value}</div>
                  {widget.trend === 'up' && (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  {widget.trend === 'down' && (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {widget.subtitle}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Stage Distribution */}
      {stats.stageDistribution && stats.stageDistribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.stageDistribution.map((stage) => {
                const percentage =
                  stats.totalPipelineValue > 0
                    ? (stage.value / stats.totalPipelineValue) * 100
                    : 0
                return (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span>{stage.stageName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {stage.count}
                        </Badge>
                      </div>
                      <span className="font-medium">{formatCurrency(stage.value)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(percentage, 1)}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Performance Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Deals
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myDeals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Assigned to you
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Deal Size
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgDealValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per open deal
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
