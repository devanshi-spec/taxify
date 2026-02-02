import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    try {
        const invitation = await prisma.invitation.findUnique({
            where: { token },
            include: {
                organization: { select: { name: true, id: true } },
                inviter: { select: { name: true, email: true } }
            }
        })

        if (!invitation) {
            return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
        }

        if (invitation.acceptedAt) {
            return NextResponse.json({ error: 'Invitation already accepted' }, { status: 410 })
        }

        if (invitation.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })
        }

        return NextResponse.json({
            data: {
                email: invitation.email,
                organizationName: invitation.organization.name,
                inviterName: invitation.inviter.name,
                role: invitation.role
            }
        })
    } catch (error) {
        console.error('Error verifying invitation:', error)
        return NextResponse.json({ error: 'Failed to verify invitation' }, { status: 500 })
    }
}
