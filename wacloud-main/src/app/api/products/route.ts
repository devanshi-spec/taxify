import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    sku: z.string().optional(),
    price: z.number().min(0),
    currency: z.string().default('INR'),
    imageUrl: z.string().url().optional().nullable(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    quantity: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
})

// GET: List all products
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

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const category = searchParams.get('category')
        const isActive = searchParams.get('isActive')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')

        const where: Record<string, unknown> = {
            organizationId: dbUser.organizationId,
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ]
        }

        if (category) {
            where.category = category
        }

        if (isActive !== null && isActive !== undefined) {
            where.isActive = isActive === 'true'
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.product.count({ where }),
        ])

        // Get unique categories
        const categories = await prisma.product.groupBy({
            by: ['category'],
            where: { organizationId: dbUser.organizationId },
            _count: true,
        })

        return NextResponse.json({
            data: products,
            total,
            page,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
            categories: categories.filter((c: any) => c.category).map((c: any) => ({
                name: c.category,
                count: c._count,
            })),
        })
    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        )
    }
}

// POST: Create a new product
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
        const validatedData = createProductSchema.parse(body)

        // Check for duplicate SKU if provided
        if (validatedData.sku) {
            const existing = await prisma.product.findFirst({
                where: {
                    organizationId: dbUser.organizationId,
                    sku: validatedData.sku,
                },
            })

            if (existing) {
                return NextResponse.json(
                    { error: 'A product with this SKU already exists' },
                    { status: 409 }
                )
            }
        }

        const product = await prisma.product.create({
            data: {
                ...validatedData,
                organizationId: dbUser.organizationId,
            },
        })

        return NextResponse.json({ data: product }, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error creating product:', error)
        return NextResponse.json(
            { error: 'Failed to create product' },
            { status: 500 }
        )
    }
}
