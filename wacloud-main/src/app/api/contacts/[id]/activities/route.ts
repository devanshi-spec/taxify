
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify contact exists and belongs to user's organization
        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { organizationId: true },
        })

        if (!dbUser?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const contact = await prisma.contact.findUnique({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Fetch activities
        const activities = await prisma.activity.findMany({
            where: {
                contactId: id,
                organizationId: dbUser.organizationId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
            include: {
                creator: {
                    select: {
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
            },
        })

        return NextResponse.json({ data: activities })
    } catch (error) {
        console.error('Failed to fetch contact activities:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
