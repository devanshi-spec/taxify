import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET: Fetch invitation details by token
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 })
        }

        const invitation = await prisma.invitation.findUnique({
            where: { token },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
        }

        // Check if already accepted
        if (invitation.acceptedAt) {
            return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
        }

        // Check if expired
        if (new Date() > invitation.expiresAt) {
            return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
        }

        return NextResponse.json({
            data: {
                id: invitation.id,
                email: invitation.email,
                role: invitation.role,
                organization: invitation.organization,
                expiresAt: invitation.expiresAt,
            },
        })
    } catch (error) {
        console.error('Error fetching invitation:', error)
        return NextResponse.json(
            { error: 'Failed to fetch invitation' },
            { status: 500 }
        )
    }
}
