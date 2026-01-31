import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const acceptInviteSchema = z.object({
    token: z.string(),
    name: z.string().min(1),
})

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const validatedData = acceptInviteSchema.parse(body)

        // Find invitation
        const invitation = await prisma.invitation.findUnique({
            where: { token: validatedData.token },
            include: {
                organization: true,
            },
        })

        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
        }

        // Validate invitation
        if (invitation.acceptedAt) {
            return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
        }

        if (new Date() > invitation.expiresAt) {
            return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
        }

        if (invitation.email !== user.email) {
            return NextResponse.json(
                { error: 'This invitation was sent to a different email address' },
                { status: 403 }
            )
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'User already exists in another organization' },
                { status: 409 }
            )
        }

        // Create user in organization
        const newUser = await prisma.user.create({
            data: {
                id: user.id,
                supabaseUserId: user.id,
                email: user.email!,
                name: validatedData.name,
                avatarUrl: user.user_metadata?.avatar_url || null,
                organizationId: invitation.organizationId,
                role: invitation.role,
            },
        })

        // Mark invitation as accepted
        await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
                acceptedAt: new Date(),
                acceptedBy: newUser.id,
            },
        })

        return NextResponse.json({
            message: 'Invitation accepted successfully',
            data: {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role,
                },
                organization: {
                    id: invitation.organization.id,
                    name: invitation.organization.name,
                },
            },
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error accepting invitation:', error)
        return NextResponse.json(
            { error: 'Failed to accept invitation' },
            { status: 500 }
        )
    }
}
