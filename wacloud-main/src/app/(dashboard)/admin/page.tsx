'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminAnalytics } from '@/components/admin/admin-analytics'
import { OrganizationsList } from '@/components/admin/organizations-list'
import { UsersManagement } from '@/components/admin/users-list'
import { SystemHealth } from '@/components/admin/system-health'
import { PaymentsManagement } from '@/components/admin/payments-management'
import { AuditLogs } from '@/components/admin/audit-logs'
import { PlatformSettings } from '@/components/admin/platform-settings'
import { Loader2, Shield } from 'lucide-react'

export default function AdminDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        checkAuthorization()
    }, [])

    const checkAuthorization = async () => {
        try {
            // Check if user is super admin
            const response = await fetch('/api/admin/check-auth')
            if (response.ok) {
                setAuthorized(true)
            } else {
                router.push('/inbox')
            }
        } catch (error) {
            router.push('/inbox')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!authorized) {
        return null
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center gap-4">
                    <Shield className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-xl font-bold">Super Admin Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Platform Management</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container py-6">
                <Tabs defaultValue="analytics" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-7">
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="organizations">Organizations</TabsTrigger>
                        <TabsTrigger value="payments">Payments</TabsTrigger>
                        <TabsTrigger value="users">Users</TabsTrigger>
                        <TabsTrigger value="system">System Health</TabsTrigger>
                        <TabsTrigger value="logs">Audit Logs</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="analytics" className="space-y-4">
                        <AdminAnalytics />
                    </TabsContent>

                    <TabsContent value="organizations" className="space-y-4">
                        <OrganizationsList />
                    </TabsContent>

                    <TabsContent value="payments" className="space-y-4">
                        <PaymentsManagement />
                    </TabsContent>

                    <TabsContent value="users" className="space-y-4">
                        <UsersManagement />
                    </TabsContent>

                    <TabsContent value="system" className="space-y-4">
                        <SystemHealth />
                    </TabsContent>

                    <TabsContent value="logs" className="space-y-4">
                        <AuditLogs />
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                        <PlatformSettings />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
