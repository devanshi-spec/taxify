import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateProductSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    price: z.number().min(0).optional(),
    currency: z.string().optional(),
    imageUrl: z.string().url().optional().nullable(),
    category: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    quantity: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
})

// GET: Get a single product
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
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

        const product = await prisma.product.findFirst({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json({ data: product })
    } catch (error) {
        console.error('Error fetching product:', error)
        return NextResponse.json(
            { error: 'Failed to fetch product' },
            { status: 500 }
        )
    }
}

// PUT: Update a product
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
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

        // Verify product belongs to organization
        const existing = await prisma.product.findFirst({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const body = await request.json()
        const validatedData = updateProductSchema.parse(body)

        // Check for duplicate SKU if changing
        if (validatedData.sku && validatedData.sku !== existing.sku) {
            const duplicate = await prisma.product.findFirst({
                where: {
                    organizationId: dbUser.organizationId,
                    sku: validatedData.sku,
                    NOT: { id },
                },
            })

            if (duplicate) {
                return NextResponse.json(
                    { error: 'A product with this SKU already exists' },
                    { status: 409 }
                )
            }
        }

        const product = await prisma.product.update({
            where: { id },
            data: validatedData,
        })

        return NextResponse.json({ data: product })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error updating product:', error)
        return NextResponse.json(
            { error: 'Failed to update product' },
            { status: 500 }
        )
    }
}

// DELETE: Delete a product
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
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

        // Verify product belongs to organization
        const existing = await prisma.product.findFirst({
            where: {
                id,
                organizationId: dbUser.organizationId,
            },
        })

        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        await prisma.product.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting product:', error)
        return NextResponse.json(
            { error: 'Failed to delete product' },
            { status: 500 }
        )
    }
}
