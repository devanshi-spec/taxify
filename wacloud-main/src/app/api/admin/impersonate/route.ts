import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withSuperAdmin } from '@/lib/auth/super-admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    return withSuperAdmin(async (admin) => {
        const { userId } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 })
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Log impersonation for audit
        await prisma.auditLog.create({
            data: {
                userId: admin.id,
                organizationId: targetUser.organizationId,
                action: 'IMPERSONATE_USER',
                entityType: 'USER',
                entityId: targetUser.id,
                metadata: {
                    adminEmail: admin.email,
                    targetEmail: targetUser.email,
                    targetOrganization: targetUser.organization.name,
                },
            },
        })

        // Return impersonation token (in real app, create JWT or session)
        return NextResponse.json({
            data: {
                userId: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                organizationId: targetUser.organizationId,
                organizationName: targetUser.organization.name,
                // In production, return a secure impersonation token
                impersonationToken: `imp_${targetUser.id}_${Date.now()}`,
            },
        })
    })
}
