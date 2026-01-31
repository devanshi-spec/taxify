import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// Validation schemas
const createBroadcastListSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    contactIds: z.array(z.string()).min(1),
})

const updateBroadcastListSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    contactIds: z.array(z.string()).optional(),
})

// GET - List all broadcast lists
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Get broadcast lists with contact count
        const lists = await prisma.$queryRaw`
      SELECT 
        bl.id,
        bl.name,
        bl.description,
        bl."createdAt",
        bl."updatedAt",
        COUNT(DISTINCT blc."contactId")::int as "contactCount"
      FROM "BroadcastList" bl
      LEFT JOIN "BroadcastListContact" blc ON bl.id = blc."broadcastListId"
      WHERE bl."organizationId" = ${dbUser.organizationId}
      GROUP BY bl.id
      ORDER BY bl."createdAt" DESC
    `

        return NextResponse.json({ data: lists })
    } catch (error) {
        console.error('Error fetching broadcast lists:', error)
        return NextResponse.json(
            { error: 'Failed to fetch broadcast lists' },
            { status: 500 }
        )
    }
}

// POST - Create new broadcast list
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const body = await request.json()
        const validationResult = createBroadcastListSchema.safeParse(body)

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: validationResult.error.issues },
                { status: 400 }
            )
        }

        const { name, description, contactIds } = validationResult.data

        // Verify all contacts belong to organization
        const contactCount = await prisma.contact.count({
            where: {
                id: { in: contactIds },
                organizationId: dbUser.organizationId,
            },
        })

        if (contactCount !== contactIds.length) {
            return NextResponse.json(
                { error: 'Some contacts do not belong to your organization' },
                { status: 400 }
            )
        }

        // Create broadcast list with contacts
        const broadcastList = await prisma.broadcastList.create({
            data: {
                name,
                description,
                organizationId: dbUser.organizationId,
                contacts: {
                    create: contactIds.map((contactId) => ({
                        contactId,
                    })),
                },
            },
            include: {
                _count: {
                    select: { contacts: true },
                },
            },
        })

        return NextResponse.json({
            data: {
                id: broadcastList.id,
                name: broadcastList.name,
                description: broadcastList.description,
                contactCount: broadcastList._count.contacts,
                createdAt: broadcastList.createdAt,
            },
        })
    } catch (error) {
        console.error('Error creating broadcast list:', error)
        return NextResponse.json(
            { error: 'Failed to create broadcast list' },
            { status: 500 }
        )
    }
}

// PUT - Update broadcast list
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const listId = searchParams.get('id')

        if (!listId) {
            return NextResponse.json({ error: 'List ID required' }, { status: 400 })
        }

        const body = await request.json()
        const validationResult = updateBroadcastListSchema.safeParse(body)

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: validationResult.error.issues },
                { status: 400 }
            )
        }

        const { name, description, contactIds } = validationResult.data

        // Verify list belongs to organization
        const existingList = await prisma.broadcastList.findFirst({
            where: {
                id: listId,
                organizationId: dbUser.organizationId,
            },
        })

        if (!existingList) {
            return NextResponse.json({ error: 'Broadcast list not found' }, { status: 404 })
        }

        // Update list
        const updateData: Record<string, unknown> = {}
        if (name) updateData.name = name
        if (description !== undefined) updateData.description = description

        const updatedList = await prisma.broadcastList.update({
            where: { id: listId },
            data: updateData,
        })

        // Update contacts if provided
        if (contactIds) {
            // Verify contacts
            const contactCount = await prisma.contact.count({
                where: {
                    id: { in: contactIds },
                    organizationId: dbUser.organizationId,
                },
            })

            if (contactCount !== contactIds.length) {
                return NextResponse.json(
                    { error: 'Some contacts do not belong to your organization' },
                    { status: 400 }
                )
            }

            // Delete existing contacts
            await prisma.broadcastListContact.deleteMany({
                where: { broadcastListId: listId },
            })

            // Add new contacts
            await prisma.broadcastListContact.createMany({
                data: contactIds.map((contactId) => ({
                    broadcastListId: listId,
                    contactId,
                })),
            })
        }

        // Get updated count
        const contactCount = await prisma.broadcastListContact.count({
            where: { broadcastListId: listId },
        })

        return NextResponse.json({
            data: {
                id: updatedList.id,
                name: updatedList.name,
                description: updatedList.description,
                contactCount,
                updatedAt: updatedList.updatedAt,
            },
        })
    } catch (error) {
        console.error('Error updating broadcast list:', error)
        return NextResponse.json(
            { error: 'Failed to update broadcast list' },
            { status: 500 }
        )
    }
}

// DELETE - Delete broadcast list
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const listId = searchParams.get('id')

        if (!listId) {
            return NextResponse.json({ error: 'List ID required' }, { status: 400 })
        }

        // Verify and delete
        const deletedList = await prisma.broadcastList.deleteMany({
            where: {
                id: listId,
                organizationId: dbUser.organizationId,
            },
        })

        if (deletedList.count === 0) {
            return NextResponse.json({ error: 'Broadcast list not found' }, { status: 404 })
        }

        return NextResponse.json({
            data: { success: true, message: 'Broadcast list deleted' },
        })
    } catch (error) {
        console.error('Error deleting broadcast list:', error)
        return NextResponse.json(
            { error: 'Failed to delete broadcast list' },
            { status: 500 }
        )
    }
}
