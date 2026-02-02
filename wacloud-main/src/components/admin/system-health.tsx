'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Server, Database, Cpu, Activity } from 'lucide-react'

export function SystemHealth() {
    const { data, isLoading } = useQuery({
        queryKey: ['admin-system'],
        queryFn: async () => {
            const res = await fetch('/api/admin/system')
            if (!res.ok) throw new Error('Failed to fetch system health')
            return res.json()
        },
        refetchInterval: 30000, // Refresh every 30s
    })

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const { status, database, system } = data || {}

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="text-2xl font-bold capitalize">{status}</div>
                    </div>
                    <p className="text-xs text-muted-foreground">Last updated just now</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Database</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-1">
                        <div className="text-2xl font-bold capitalize">{database?.status}</div>
                        <Badge variant="outline" className="w-fit">
                            Latency: {database?.latency}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-1">
                        <div className="text-sm font-medium truncate">{system?.platform} ({system?.arch})</div>
                        <p className="text-xs text-muted-foreground">
                            Uptime: {Math.floor(system?.uptime / 3600)}h {Math.floor((system?.uptime % 3600) / 60)}m
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Resources</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-1">
                        <div className="text-2xl font-bold">{system?.cpus} Cores</div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary"
                                style={{ width: `${100 - (system?.memory.free / system?.memory.total * 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Memory: {Math.round((system?.memory.total - system?.memory.free) / 1024 / 1024 / 1024)}GB / {Math.round(system?.memory.total / 1024 / 1024 / 1024)}GB
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
