import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// Sync products to WhatsApp Catalog
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true, organization: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const body = await request.json()
        const { productIds, channelId } = body

        // Get channel for WhatsApp credentials
        const channel = await prisma.channel.findFirst({
            where: {
                id: channelId,
                organizationId: dbUser.organizationId,
            },
        })

        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
        }

        // Get products to sync
        const products = await prisma.product.findMany({
            where: {
                id: productIds ? { in: productIds } : undefined,
                organizationId: dbUser.organizationId,
                isActive: true,
            },
        })

        if (products.length === 0) {
            return NextResponse.json({ error: 'No products to sync' }, { status: 400 })
        }

        // Sync to WhatsApp based on connection type
        let syncResults
        if (channel.connectionType === 'CLOUD_API' && channel.wabaId) {
            syncResults = await syncToWhatsAppCloudAPI(channel, products)
        } else {
            return NextResponse.json(
                { error: 'WhatsApp Catalog sync requires Cloud API connection' },
                { status: 400 }
            )
        }

        // Update sync status in database
        for (const result of syncResults) {
            await prisma.product.update({
                where: { id: result.productId },
                data: {
                    waProductId: result.waProductId,
                    waCatalogId: result.waCatalogId,
                    syncStatus: result.success ? 'SYNCED' : 'FAILED',
                    lastSyncedAt: new Date(),
                },
            })
        }

        const successCount = syncResults.filter(r => r.success).length
        const failedCount = syncResults.filter(r => !r.success).length

        return NextResponse.json({
            success: true,
            synced: successCount,
            failed: failedCount,
            results: syncResults,
        })
    } catch (error) {
        console.error('Error syncing products:', error)
        return NextResponse.json(
            { error: 'Failed to sync products' },
            { status: 500 }
        )
    }
}

// Sync products to WhatsApp Cloud API Catalog
async function syncToWhatsAppCloudAPI(
    channel: { wabaId: string | null; settings: unknown },
    products: Array<{
        id: string
        name: string
        description: string | null
        price: number
        currency: string
        imageUrl: string | null
        sku: string | null
    }>
) {
    const settings = channel.settings as { accessToken?: string } | null
    const accessToken = settings?.accessToken || process.env.META_ACCESS_TOKEN

    if (!accessToken || !channel.wabaId) {
        throw new Error('Missing WhatsApp Business API credentials')
    }

    const results = []

    for (const product of products) {
        try {
            // Create or update product in WhatsApp Catalog
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${channel.wabaId}/product_catalogs`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: product.name,
                        description: product.description || '',
                        price: Math.round(product.price * 100), // Convert to cents
                        currency: product.currency,
                        image_url: product.imageUrl,
                        retailer_id: product.sku || product.id,
                        availability: 'in stock',
                    }),
                }
            )

            const data = await response.json()

            if (response.ok && data.id) {
                results.push({
                    productId: product.id,
                    waProductId: data.id,
                    waCatalogId: channel.wabaId,
                    success: true,
                })
            } else {
                results.push({
                    productId: product.id,
                    waProductId: null,
                    waCatalogId: null,
                    success: false,
                    error: data.error?.message || 'Unknown error',
                })
            }
        } catch (error) {
            results.push({
                productId: product.id,
                waProductId: null,
                waCatalogId: null,
                success: false,
                error: error instanceof Error ? error.message : 'Sync failed',
            })
        }
    }

    return results
}

// GET: Get sync status
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

        const stats = await prisma.product.groupBy({
            by: ['syncStatus'],
            where: { organizationId: dbUser.organizationId },
            _count: true,
        })

        const lastSynced = await prisma.product.findFirst({
            where: {
                organizationId: dbUser.organizationId,
                lastSyncedAt: { not: null },
            },
            orderBy: { lastSyncedAt: 'desc' },
            select: { lastSyncedAt: true },
        })

        return NextResponse.json({
            data: {
                stats: stats.map((s: any) => ({
                    status: s.syncStatus,
                    count: s._count,
                })),
                lastSyncedAt: lastSynced?.lastSyncedAt,
            },
        })
    } catch (error) {
        console.error('Error fetching sync status:', error)
        return NextResponse.json(
            { error: 'Failed to fetch sync status' },
            { status: 500 }
        )
    }
}
