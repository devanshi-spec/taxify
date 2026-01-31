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
import { Loader2, Search, LogIn, User } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface UserItem {
    id: string
    name: string | null
    email: string
    role: string
    lastLoginAt: string | null
    organization: {
        id: string
        name: string
    }
}

export function UsersManagement() {
    const router = useRouter()
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['admin-users', page, search],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                search,
            })
            const res = await fetch(`/api/admin/users?${params}`)
            if (!res.ok) throw new Error('Failed to fetch users')
            return res.json()
        },
    })

    const handleImpersonate = async (userId: string) => {
        try {
            setImpersonatingId(userId)
            const res = await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            })

            if (!res.ok) {
                throw new Error('Failed to impersonate')
            }

            const { data } = await res.json()
            toast.success(`Now impersonating ${data.name || data.email}`)
            // In a real app, you would set a cookie/token here and reload
            // For now, we just redirect to dashboard
            router.push('/dashboard')
        } catch (error) {
            toast.error('Failed to start impersonation')
        } finally {
            setImpersonatingId(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Users</h2>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
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
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Last Login</TableHead>
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
                                    No users found
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data?.map((user: UserItem) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.name || 'Unnamed'}</span>
                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'OWNER' ? 'default' : 'secondary'}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{user.organization.name}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {user.lastLoginAt
                                            ? format(new Date(user.lastLoginAt), 'MMM d, h:mm a')
                                            : 'Never'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleImpersonate(user.id)}
                                            disabled={impersonatingId === user.id}
                                        >
                                            {impersonatingId === user.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <LogIn className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                            )}
                                            <span className="sr-only">Impersonate</span>
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
