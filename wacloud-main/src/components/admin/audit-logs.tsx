'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Loader2, Search, FileText, User, Settings, Trash2, Edit, Plus, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AuditLogEntry {
    id: string
    userId: string
    userName?: string
    action: string
    entityType: string
    entityId?: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    ipAddress?: string
    createdAt: string
}

export function AuditLogs() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [actionFilter, setActionFilter] = useState<string>('all')
    const [entityFilter, setEntityFilter] = useState<string>('all')

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/audit-logs')
            if (response.ok) {
                const data = await response.json()
                setLogs(data.logs || [])
            }
        } catch (error) {
            console.error('Failed to fetch audit logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getActionIcon = (action: string) => {
        if (action.includes('CREATE') || action.includes('ADD')) return <Plus className="h-4 w-4 text-green-500" />
        if (action.includes('DELETE') || action.includes('REMOVE')) return <Trash2 className="h-4 w-4 text-red-500" />
        if (action.includes('UPDATE') || action.includes('EDIT')) return <Edit className="h-4 w-4 text-blue-500" />
        if (action.includes('VIEW') || action.includes('READ')) return <Eye className="h-4 w-4 text-gray-500" />
        return <Settings className="h-4 w-4 text-gray-500" />
    }

    const getActionBadgeColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        if (action.includes('DELETE')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }

    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchQuery === '' ||
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.userName && log.userName.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter)
        const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter

        return matchesSearch && matchesAction && matchesEntity
    })

    const uniqueActions = [...new Set(logs.map(l => l.action.split('_')[0]))]
    const uniqueEntities = [...new Set(logs.map(l => l.entityType))]

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Audit Logs
                    </CardTitle>
                    <CardDescription>
                        Track all actions performed across the platform
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {uniqueActions.map(action => (
                                    <SelectItem key={action} value={action}>{action}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Entity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entities</SelectItem>
                                {uniqueEntities.map(entity => (
                                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={fetchLogs}>
                            Refresh
                        </Button>
                    </div>

                    {/* Table */}
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No audit logs found</p>
                            <p className="text-sm">Actions will appear here as users interact with the platform</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Timestamp</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Entity</TableHead>
                                        <TableHead>IP Address</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogs.slice(0, 50).map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">{log.userName || log.userId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getActionIcon(log.action)}
                                                    <Badge className={getActionBadgeColor(log.action)} variant="outline">
                                                        {log.action}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium">{log.entityType}</span>
                                                {log.entityId && (
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        #{log.entityId.slice(0, 8)}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {log.ipAddress || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {filteredLogs.length > 50 && (
                        <p className="text-sm text-muted-foreground mt-4 text-center">
                            Showing 50 of {filteredLogs.length} logs
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
