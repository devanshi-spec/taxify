import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import {
    setOrganizationApiKey,
    removeOrganizationApiKey,
    testApiKey,
    updateAiModelConfig,
} from '@/lib/ai/key-management'
import { z } from 'zod'

const setKeySchema = z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini']),
    apiKey: z.string().min(1),
})

const updateConfigSchema = z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
})

// GET: Get organization AI settings
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: {
                organizationId: true,
                role: true,
                organization: {
                    select: {
                        useOwnAiKeys: true,
                        aiModel: true,
                        aiTemperature: true,
                        openaiApiKey: true,
                        anthropicApiKey: true,
                        geminiApiKey: true,
                    },
                },
            },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only owners and admins can view AI settings
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        return NextResponse.json({
            data: {
                useOwnKeys: dbUser.organization.useOwnAiKeys,
                model: dbUser.organization.aiModel,
                temperature: dbUser.organization.aiTemperature,
                keysConfigured: {
                    openai: !!dbUser.organization.openaiApiKey,
                    anthropic: !!dbUser.organization.anthropicApiKey,
                    gemini: !!dbUser.organization.geminiApiKey,
                },
            },
        })
    } catch (error) {
        console.error('Error fetching AI settings:', error)
        return NextResponse.json(
            { error: 'Failed to fetch AI settings' },
            { status: 500 }
        )
    }
}

// POST: Set organization API key
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: {
                organizationId: true,
                role: true,
            },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only owners and admins can set API keys
        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const body = await request.json()
        const { provider, apiKey } = setKeySchema.parse(body)

        // Test the API key before saving
        const test = await testApiKey(provider, apiKey)
        if (!test.valid) {
            return NextResponse.json(
                { error: `Invalid ${provider} API key: ${test.error || 'Authentication failed'}` },
                { status: 400 }
            )
        }

        // Save the API key
        await setOrganizationApiKey(dbUser.organizationId, provider, apiKey)

        return NextResponse.json({
            message: `${provider} API key configured successfully`,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error setting API key:', error)
        return NextResponse.json(
            { error: 'Failed to set API key' },
            { status: 500 }
        )
    }
}

// PUT: Update AI model configuration
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: {
                organizationId: true,
                role: true,
            },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const body = await request.json()
        const config = updateConfigSchema.parse(body)

        await updateAiModelConfig(dbUser.organizationId, config)

        return NextResponse.json({
            message: 'AI configuration updated successfully',
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error updating AI config:', error)
        return NextResponse.json(
            { error: 'Failed to update AI configuration' },
            { status: 500 }
        )
    }
}

// DELETE: Remove organization API key
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: {
                organizationId: true,
                role: true,
            },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (dbUser.role !== 'OWNER' && dbUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const provider = searchParams.get('provider') as 'openai' | 'anthropic' | 'gemini'

        if (!provider || !['openai', 'anthropic', 'gemini'].includes(provider)) {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
        }

        await removeOrganizationApiKey(dbUser.organizationId, provider)

        return NextResponse.json({
            message: `${provider} API key removed successfully`,
        })
    } catch (error) {
        console.error('Error removing API key:', error)
        return NextResponse.json(
            { error: 'Failed to remove API key' },
            { status: 500 }
        )
    }
}
