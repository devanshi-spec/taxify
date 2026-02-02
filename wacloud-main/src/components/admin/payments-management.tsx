'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, DollarSign, AlertTriangle, TrendingUp, CreditCard } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface PaymentData {
    revenue: {
        mrr: number
        arr: number
        growth: number
    }
    subscriptions: {
        active: number
        trialing: number
        pastDue: number
        canceled: number
    }
    failedPayments: Array<{
        organizationId: string
        organizationName: string
        amount: number
        failedAt: string
        reason: string
    }>
    recentPayments: Array<{
        organizationId: string
        organizationName: string
        amount: number
        plan: string
        paidAt: string
    }>
}

export function PaymentsManagement() {
    const [data, setData] = useState<PaymentData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPayments()
    }, [])

    const fetchPayments = async () => {
        try {
            const response = await fetch('/api/admin/payments')
            if (response.ok) {
                const result = await response.json()
                setData(result.data)
            }
        } catch (error) {
            console.error('Failed to fetch payments:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                Failed to load payment data
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Revenue Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">MRR</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.revenue.mrr)}</div>
                        <p className="text-xs text-muted-foreground">
                            Monthly Recurring Revenue
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ARR</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.revenue.arr)}</div>
                        <p className="text-xs text-muted-foreground">
                            Annual Recurring Revenue
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                        <CreditCard className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.subscriptions.active}</div>
                        <p className="text-xs text-muted-foreground">
                            {data.subscriptions.trialing} in trial
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.subscriptions.pastDue}</div>
                        <p className="text-xs text-muted-foreground">
                            Requires attention
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Failed Payments */}
            {data.failedPayments && data.failedPayments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Failed Payments</CardTitle>
                        <CardDescription>Organizations with payment issues</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Organization</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Failed At</TableHead>
                                        <TableHead>Reason</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.failedPayments.map((payment, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">
                                                {payment.organizationName}
                                            </TableCell>
                                            <TableCell>{formatCurrency(payment.amount)}</TableCell>
                                            <TableCell>
                                                {new Date(payment.failedAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="destructive">{payment.reason}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Payments */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Payments</CardTitle>
                    <CardDescription>Latest successful transactions</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {data.recentPayments && data.recentPayments.length > 0 ? (
                            data.recentPayments.map((payment, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{payment.organizationName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(payment.paidAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge>{payment.plan}</Badge>
                                        <span className="font-bold">{formatCurrency(payment.amount)}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-4">
                                No recent payments
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
