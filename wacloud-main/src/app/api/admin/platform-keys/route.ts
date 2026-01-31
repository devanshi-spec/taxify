import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/auth/super-admin'
import { prisma } from '@/lib/db'
import { setPlatformApiKey, testApiKey } from '@/lib/ai/key-management'
import { z } from 'zod'

const setPlatformKeySchema = z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini']),
    apiKey: z.string().min(1),
})

// GET: Get all platform settings (super admin only)
export async function GET() {
    return withSuperAdmin(async () => {
        const settings = await prisma.platformSettings.findMany({
            select: {
                id: true,
                key: true,
                description: true,
                isSecret: true,
                createdAt: true,
                updatedAt: true,
                // Don't return actual values for security
            },
            orderBy: { key: 'asc' },
        })

        // Check which keys are configured
        const keysConfigured = {
            openai: settings.some((s: { key: string }) => s.key === 'platform_openai_api_key'),
            anthropic: settings.some((s: { key: string }) => s.key === 'platform_anthropic_api_key'),
            gemini: settings.some((s: { key: string }) => s.key === 'platform_gemini_api_key'),
        }

        return NextResponse.json({
            data: {
                settings,
                keysConfigured,
            },
        })
    })
}

// POST: Set platform API key (super admin only)
export async function POST(request: NextRequest) {
    return withSuperAdmin(async (admin) => {
        const body = await request.json()
        const { provider, apiKey } = setPlatformKeySchema.parse(body)

        // Test the API key before saving
        const test = await testApiKey(provider, apiKey)
        if (!test.valid) {
            return NextResponse.json(
                { error: `Invalid ${provider} API key: ${test.error || 'Authentication failed'}` },
                { status: 400 }
            )
        }

        // Save the platform API key
        await setPlatformApiKey(provider, apiKey)

        // Log the action
        await prisma.auditLog.create({
            data: {
                userId: admin.id,
                organizationId: admin.organizationId,
                action: 'SET_PLATFORM_API_KEY',
                entityType: 'PLATFORM_SETTINGS',
                entityId: `platform_${provider}_api_key`,
                metadata: {
                    provider,
                    adminEmail: admin.email,
                },
            },
        })

        return NextResponse.json({
            message: `Platform ${provider} API key configured successfully`,
        })
    })
}

// DELETE: Remove platform API key (super admin only)
export async function DELETE(request: NextRequest) {
    return withSuperAdmin(async (admin) => {
        const { searchParams } = new URL(request.url)
        const provider = searchParams.get('provider')

        if (!provider || !['openai', 'anthropic', 'gemini'].includes(provider)) {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
        }

        const keyMap = {
            openai: 'platform_openai_api_key',
            anthropic: 'platform_anthropic_api_key',
            gemini: 'platform_gemini_api_key',
        }

        await prisma.platformSettings.delete({
            where: { key: keyMap[provider as keyof typeof keyMap] },
        })

        // Log the action
        await prisma.auditLog.create({
            data: {
                userId: admin.id,
                organizationId: admin.organizationId,
                action: 'DELETE_PLATFORM_API_KEY',
                entityType: 'PLATFORM_SETTINGS',
                entityId: `platform_${provider}_api_key`,
                metadata: {
                    provider,
                    adminEmail: admin.email,
                },
            },
        })

        return NextResponse.json({
            message: `Platform ${provider} API key removed successfully`,
        })
    })
}
