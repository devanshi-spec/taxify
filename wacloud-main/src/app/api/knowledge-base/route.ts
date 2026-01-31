import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/db'

// GET /api/knowledge-base - List all knowledge documents
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user's organization
        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { organizationId: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const documents = await prisma.knowledgeDocument.findMany({
            where: { organizationId: dbUser.organizationId },
            orderBy: { createdAt: 'desc' },
        })

        // Calculate stats
        const stats = {
            total: documents.length,
            indexed: documents.filter(d => d.status === 'INDEXED').length,
            pending: documents.filter(d => d.status === 'PENDING' || d.status === 'INDEXING').length,
            failed: documents.filter(d => d.status === 'FAILED').length,
        }

        return NextResponse.json({ documents, stats })
    } catch (error) {
        console.error('Error fetching knowledge documents:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/knowledge-base - Add new document or URL
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const body = await request.json()
        const { name, type, externalUrl, storageUrl, storagePath, fileSize, mimeType } = body

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
        }

        // Validate type
        const validTypes = ['PDF', 'DOCX', 'TXT', 'URL', 'CSV']
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
        }

        // For URL type, externalUrl is required
        if (type === 'URL' && !externalUrl) {
            return NextResponse.json({ error: 'External URL is required for URL type' }, { status: 400 })
        }

        const document = await prisma.knowledgeDocument.create({
            data: {
                name,
                type,
                externalUrl,
                storageUrl,
                storagePath,
                fileSize,
                mimeType,
                status: 'PENDING',
                organizationId: dbUser.organizationId,
                createdBy: dbUser.id,
            },
        })

        // TODO: Trigger background job to process and index the document
        // For now, we'll simulate indexing by setting status to INDEXING
        await prisma.knowledgeDocument.update({
            where: { id: document.id },
            data: { status: 'INDEXING' },
        })

        return NextResponse.json({ document }, { status: 201 })
    } catch (error) {
        console.error('Error creating knowledge document:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/knowledge-base - Bulk delete documents
export async function DELETE(request: NextRequest) {
    try {
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
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Document IDs are required' }, { status: 400 })
        }

        // Delete only documents belonging to user's organization
        const result = await prisma.knowledgeDocument.deleteMany({
            where: {
                id: { in: ids },
                organizationId: dbUser.organizationId,
            },
        })

        return NextResponse.json({ deleted: result.count })
    } catch (error) {
        console.error('Error deleting knowledge documents:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
