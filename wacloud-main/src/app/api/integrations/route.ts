import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const integrationSchema = z.object({
    integrationId: z.string(),
    apiKey: z.string().optional(),
    apiUrl: z.string().url().optional(),
    enabled: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
})

// GET: Fetch organization integrations
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true, role: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only admins/owners can view integrations
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        // Get organization settings (integrations stored in JSON field)
        const organization = await prisma.organization.findUnique({
            where: { id: dbUser.organizationId },
            select: { id: true },
        })

        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
        }

        // For now, return integration status based on environment variables
        // In production, you'd store these in a separate integrations table
        const integrations = {
            'evolution-api': {
                connected: !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY,
                apiUrl: process.env.EVOLUTION_API_URL || null,
            },
            'openai': {
                connected: !!process.env.OPENAI_API_KEY,
            },
            'anthropic': {
                connected: !!process.env.ANTHROPIC_API_KEY,
            },
            'google-ai': {
                connected: !!process.env.GOOGLE_AI_API_KEY,
            },
            'webhook': {
                connected: true, // Webhooks are always available
            },
        }

        return NextResponse.json({ data: integrations })
    } catch (error) {
        console.error('Error fetching integrations:', error)
        return NextResponse.json(
            { error: 'Failed to fetch integrations' },
            { status: 500 }
        )
    }
}

// POST: Connect/Update integration
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true, role: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only admins/owners can manage integrations
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const body = await request.json()
        const validatedData = integrationSchema.parse(body)

        // Note: In a production app, you'd store encrypted API keys in database
        // For now, we'll just validate and return success
        // The actual keys should be set via environment variables or secure secret management

        console.log(`[Integrations] ${validatedData.integrationId} configuration updated`)

        return NextResponse.json({
            success: true,
            message: 'Integration configured successfully. Please update environment variables for production use.',
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error configuring integration:', error)
        return NextResponse.json(
            { error: 'Failed to configure integration' },
            { status: 500 }
        )
    }
}

// DELETE: Disconnect integration
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true, role: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only admins/owners can manage integrations
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const integrationId = searchParams.get('id')

        if (!integrationId) {
            return NextResponse.json({ error: 'Integration ID required' }, { status: 400 })
        }

        console.log(`[Integrations] ${integrationId} disconnected`)

        return NextResponse.json({
            success: true,
            message: 'Integration disconnected. Remove environment variables to complete.',
        })
    } catch (error) {
        console.error('Error disconnecting integration:', error)
        return NextResponse.json(
            { error: 'Failed to disconnect integration' },
            { status: 500 }
        )
    }
}
