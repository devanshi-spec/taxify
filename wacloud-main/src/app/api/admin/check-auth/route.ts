import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export async function GET() {
    const auth = await requireSuperAdmin()

    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    return NextResponse.json({
        authorized: true,
        user: {
            id: auth.user!.id,
            email: auth.user!.email,
            name: auth.user!.name,
        },
    })
}
