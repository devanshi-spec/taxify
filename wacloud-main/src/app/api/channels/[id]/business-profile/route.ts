import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { createWhatsAppCloudClient } from '@/lib/evolution-api/whatsapp-cloud'

// GET - Get business profile
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id: channelId } = await params

        // Get channel
        const channel = await prisma.channel.findFirst({
            where: {
                id: channelId,
                organizationId: dbUser.organizationId,
                connectionType: 'CLOUD_API',
            },
        })

        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
        }

        if (!channel.phoneNumberId) {
            return NextResponse.json(
                { error: 'Channel not configured for Cloud API' },
                { status: 400 }
            )
        }

        // Get business profile from Meta
        const client = createWhatsAppCloudClient({
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
            phoneNumberId: channel.phoneNumberId,
            businessAccountId: channel.wabaId || undefined,
        })

        const profile = await client.getBusinessProfile()

        return NextResponse.json({ data: profile })
    } catch (error) {
        console.error('Error fetching business profile:', error)
        return NextResponse.json(
            { error: 'Failed to fetch business profile' },
            { status: 500 }
        )
    }
}

// PUT - Update business profile
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id: channelId } = await params

        // Get channel
        const channel = await prisma.channel.findFirst({
            where: {
                id: channelId,
                organizationId: dbUser.organizationId,
                connectionType: 'CLOUD_API',
            },
        })

        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
        }

        if (!channel.phoneNumberId) {
            return NextResponse.json(
                { error: 'Channel not configured for Cloud API' },
                { status: 400 }
            )
        }

        const body = await request.json()

        // Validate profile data
        const allowedFields = ['about', 'address', 'description', 'email', 'websites', 'vertical']
        const profileData: Record<string, unknown> = {}

        for (const field of allowedFields) {
            if (field in body) {
                profileData[field] = body[field]
            }
        }

        if (Object.keys(profileData).length === 0) {
            return NextResponse.json(
                { error: 'No valid profile fields provided' },
                { status: 400 }
            )
        }

        // Update business profile on Meta
        const client = createWhatsAppCloudClient({
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
            phoneNumberId: channel.phoneNumberId,
            businessAccountId: channel.wabaId || undefined,
        })

        await client.updateBusinessProfile(profileData)

        // Update channel's business profile cache
        await prisma.channel.update({
            where: { id: channel.id },
            data: {
                businessProfile: profileData as import('@prisma/client/runtime/library').InputJsonValue,
            },
        })

        return NextResponse.json({
            data: {
                success: true,
                message: 'Business profile updated successfully',
                profile: profileData,
            },
        })
    } catch (error) {
        console.error('Error updating business profile:', error)

        // Handle Meta API errors
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
            const metaError = axiosError.response?.data?.error?.message

            return NextResponse.json(
                { error: metaError || 'Failed to update business profile on Meta' },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: 'Failed to update business profile' },
            { status: 500 }
        )
    }
}
