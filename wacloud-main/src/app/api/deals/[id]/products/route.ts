import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

// Cast prisma to any to avoid type errors during development when schema changes haven't fully propagated to LSP
const db = prisma as any

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: dealId } = await params

    try {
        const products = await db.dealProduct.findMany({
            where: { dealId },
            include: {
                product: {
                    select: {
                        name: true,
                        imageUrl: true,
                        sku: true
                    }
                }
            }
        })

        return NextResponse.json(products)
    } catch (error) {
        console.error('Error fetching deal products:', error)
        return NextResponse.json({ error: 'Failed to fetch deal products' }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: dealId } = await params
    const { productId, quantity, unitPrice } = await request.json()

    if (!productId || !quantity || !unitPrice) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    try {
        const dealProduct = await db.dealProduct.upsert({
            where: {
                dealId_productId: {
                    dealId,
                    productId
                }
            },
            update: {
                quantity,
                unitPrice
            },
            create: {
                dealId,
                productId,
                quantity,
                unitPrice
            }
        })

        // Update Deal Value
        // 1. Get all products for this deal
        const allProducts = await db.dealProduct.findMany({
            where: { dealId }
        })

        // 2. Calculate total
        const totalValue = allProducts.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + (item.quantity * item.unitPrice), 0)

        // 3. Update Deal
        await prisma.deal.update({
            where: { id: dealId },
            data: { value: totalValue }
        })

        return NextResponse.json(dealProduct)
    } catch (error) {
        console.error('Error adding product to deal:', error)
        return NextResponse.json({ error: 'Failed to add product' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: dealId } = await params
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
        return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    try {
        await db.dealProduct.delete({
            where: {
                dealId_productId: {
                    dealId,
                    productId
                }
            }
        })

        // Update Deal Value
        const allProducts = await db.dealProduct.findMany({
            where: { dealId }
        })
        const totalValue = allProducts.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + (item.quantity * item.unitPrice), 0)
        await prisma.deal.update({
            where: { id: dealId },
            data: { value: totalValue }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error removing product from deal:', error)
        return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 })
    }
}
