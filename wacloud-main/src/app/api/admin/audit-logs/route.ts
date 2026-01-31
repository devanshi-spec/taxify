import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/db'

// GET /api/admin/audit-logs - List all audit logs (super admin only)
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is super admin
        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { isSuperAdmin: true }
        })

        if (!dbUser?.isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Fetch audit logs with user info
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
        })

        // Get unique user IDs and fetch their names
        const userIds = [...new Set(logs.map(l => l.userId))]
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
        })
        const userMap = new Map(users.map(u => [u.id, u.name || u.email]))

        const enrichedLogs = logs.map(log => ({
            ...log,
            userName: userMap.get(log.userId) || log.userId,
        }))

        return NextResponse.json({ logs: enrichedLogs })
    } catch (error) {
        console.error('Error fetching audit logs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
