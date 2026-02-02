'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Building } from 'lucide-react'
import { format } from 'date-fns'

interface Organization {
    id: string
    name: string
    slug: string
    plan: string
    billingEmail: string | null
    createdAt: string
    _count: {
        users: number
        contacts: number
        conversations: number
    }
}

export function OrganizationsList() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['admin-organizations', page, search],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                search,
            })
            const res = await fetch(`/api/admin/organizations?${params}`)
            if (!res.ok) throw new Error('Failed to fetch organizations')
            return res.json()
        },
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Organizations</h2>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search organizations..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Stats</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data?.data?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No organizations found
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data?.map((org: Organization) => (
                                <TableRow key={org.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{org.name}</span>
                                            <span className="text-xs text-muted-foreground">{org.slug}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={org.plan === 'FREE' ? 'secondary' : 'default'}>
                                            {org.plan}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-3 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Building className="h-3 w-3" />
                                                {org._count.users} Users
                                            </div>
                                            <div>{org._count.contacts} Contacts</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {format(new Date(org.createdAt), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">
                                            Manage
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {data?.pagination && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {data.pagination.pages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                        disabled={page === data.pagination.pages}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    )
}
