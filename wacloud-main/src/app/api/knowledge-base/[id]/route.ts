import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/db'

// GET /api/knowledge-base/[id] - Get single document
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { organizationId: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const document = await prisma.knowledgeDocument.findFirst({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        return NextResponse.json({ document })
    } catch (error) {
        console.error('Error fetching knowledge document:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/knowledge-base/[id] - Update document (e.g., re-index)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { organizationId: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const body = await request.json()
        const { name, reindex } = body

        // Check document exists and belongs to org
        const existing = await prisma.knowledgeDocument.findFirst({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!existing) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        const updateData: Record<string, unknown> = {}

        if (name) {
            updateData.name = name
        }

        if (reindex) {
            // Trigger re-indexing
            updateData.status = 'PENDING'
            updateData.chunkCount = 0
            updateData.lastIndexedAt = null
            updateData.errorMessage = null
        }

        const document = await prisma.knowledgeDocument.update({
            where: { id },
            data: updateData,
        })

        // TODO: If reindex is true, trigger background job

        return NextResponse.json({ document })
    } catch (error) {
        console.error('Error updating knowledge document:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/knowledge-base/[id] - Delete single document
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { organizationId: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Check document exists and belongs to org
        const existing = await prisma.knowledgeDocument.findFirst({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!existing) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // TODO: If document has storage, delete from Supabase storage

        await prisma.knowledgeDocument.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting knowledge document:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
