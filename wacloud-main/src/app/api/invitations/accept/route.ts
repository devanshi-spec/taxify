import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = await request.json()

    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    try {
        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get and Validate Invitation
            const invitation = await tx.invitation.findUnique({
                where: { token },
                include: { organization: true }
            })

            if (!invitation) throw new Error('Invalid invitation')
            if (invitation.acceptedAt) throw new Error('Already accepted')
            if (invitation.expiresAt < new Date()) throw new Error('Expired')

            // 2. Check if user email matches (optional strict check)
            // For now, we allow accepting with a different email if logged in, 
            // but warning the user in UI is better. Here we proceed.

            // 3. Update User
            const dbUser = await tx.user.findUnique({
                where: { supabaseUserId: user.id }
            })

            if (!dbUser) throw new Error('User record not found')

            await tx.user.update({
                where: { id: dbUser.id },
                data: {
                    organizationId: invitation.organizationId,
                    role: invitation.role
                }
            })

            // 4. Mark Invitation Accepted
            await tx.invitation.update({
                where: { id: invitation.id },
                data: {
                    acceptedAt: new Date(),
                    acceptedBy: dbUser.id
                }
            })

            return invitation.organization
        })

        return NextResponse.json({ data: { organizationId: result.id, name: result.name } })

    } catch (error: any) {
        console.error('Error accepting invitation:', error)
        return NextResponse.json({ error: error.message || 'Failed to accept invitation' }, { status: 400 })
    }
}
