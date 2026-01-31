import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * Check if user is a super admin
 */
export async function requireSuperAdmin() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { authorized: false, error: 'Unauthorized', status: 401 }
    }

    const dbUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
            organizationId: true,
        },
    })

    if (!dbUser) {
        return { authorized: false, error: 'User not found', status: 404 }
    }

    if (!dbUser.isSuperAdmin) {
        return { authorized: false, error: 'Access denied. Super admin only.', status: 403 }
    }

    return { authorized: true, user: dbUser }
}

/**
 * Wrapper for super admin API routes
 */
export async function withSuperAdmin<T>(
    handler: (user: { id: string; email: string; name: string | null }) => Promise<T>
): Promise<NextResponse | T> {
    const auth = await requireSuperAdmin()

    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    return handler(auth.user!)
}
