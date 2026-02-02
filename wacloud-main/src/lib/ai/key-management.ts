import { prisma } from '@/lib/db'
import crypto from 'crypto'

// Encryption key from environment (in production, use proper key management)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!!'
const ALGORITHM = 'aes-256-cbc'

/**
 * Encrypt sensitive data
 */
function encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
        iv
    )
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
}

/**
 * Decrypt sensitive data
 */
function decrypt(text: string): string {
    const parts = text.split(':')
    const iv = Buffer.from(parts.shift()!, 'hex')
    const encryptedText = Buffer.from(parts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
        iv
    )
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}

/**
 * Get AI API key for an organization
 * Falls back to platform keys if organization doesn't have own keys
 */
export async function getAiApiKey(
    organizationId: string,
    provider: 'openai' | 'anthropic' | 'gemini'
): Promise<string | null> {
    // Get organization settings
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            useOwnAiKeys: true,
            openaiApiKey: true,
            anthropicApiKey: true,
            geminiApiKey: true,
        },
    })

    if (!org) {
        throw new Error('Organization not found')
    }

    // If organization uses own keys, return their key
    if (org.useOwnAiKeys) {
        const keyMap = {
            openai: org.openaiApiKey,
            anthropic: org.anthropicApiKey,
            gemini: org.geminiApiKey,
        }

        const encryptedKey = keyMap[provider]
        if (!encryptedKey) {
            throw new Error(`${provider} API key not configured for this organization`)
        }

        return decrypt(encryptedKey)
    }

    // Otherwise, use platform keys
    return getPlatformApiKey(provider)
}

/**
 * Get platform-wide API key (super admin managed)
 */
export async function getPlatformApiKey(
    provider: 'openai' | 'anthropic' | 'gemini'
): Promise<string | null> {
    const keyMap = {
        openai: 'platform_openai_api_key',
        anthropic: 'platform_anthropic_api_key',
        gemini: 'platform_gemini_api_key',
    }

    const setting = await prisma.platformSettings.findUnique({
        where: { key: keyMap[provider] },
    })

    if (!setting) {
        // Fallback to environment variable
        const envMap = {
            openai: process.env.OPENAI_API_KEY,
            anthropic: process.env.ANTHROPIC_API_KEY,
            gemini: process.env.GEMINI_API_KEY,
        }
        return envMap[provider] || null
    }

    return decrypt(setting.value)
}

/**
 * Set organization AI API key
 */
export async function setOrganizationApiKey(
    organizationId: string,
    provider: 'openai' | 'anthropic' | 'gemini',
    apiKey: string
): Promise<void> {
    const encrypted = encrypt(apiKey)

    const updateData: any = {
        useOwnAiKeys: true,
    }

    if (provider === 'openai') updateData.openaiApiKey = encrypted
    if (provider === 'anthropic') updateData.anthropicApiKey = encrypted
    if (provider === 'gemini') updateData.geminiApiKey = encrypted

    await prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
    })
}

/**
 * Remove organization AI API key
 */
export async function removeOrganizationApiKey(
    organizationId: string,
    provider: 'openai' | 'anthropic' | 'gemini'
): Promise<void> {
    const updateData: any = {}

    if (provider === 'openai') updateData.openaiApiKey = null
    if (provider === 'anthropic') updateData.anthropicApiKey = null
    if (provider === 'gemini') updateData.geminiApiKey = null

    await prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
    })
}

/**
 * Set platform API key (super admin only)
 */
export async function setPlatformApiKey(
    provider: 'openai' | 'anthropic' | 'gemini',
    apiKey: string
): Promise<void> {
    const encrypted = encrypt(apiKey)

    const keyMap = {
        openai: 'platform_openai_api_key',
        anthropic: 'platform_anthropic_api_key',
        gemini: 'platform_gemini_api_key',
    }

    const descriptionMap = {
        openai: 'Platform-wide OpenAI API key',
        anthropic: 'Platform-wide Anthropic API key',
        gemini: 'Platform-wide Google Gemini API key',
    }

    await prisma.platformSettings.upsert({
        where: { key: keyMap[provider] },
        create: {
            key: keyMap[provider],
            value: encrypted,
            description: descriptionMap[provider],
            isSecret: true,
        },
        update: {
            value: encrypted,
        },
    })
}

/**
 * Get AI model configuration for organization
 */
export async function getAiModelConfig(organizationId: string) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            aiModel: true,
            aiTemperature: true,
            useOwnAiKeys: true,
        },
    })

    if (!org) {
        throw new Error('Organization not found')
    }

    return {
        model: org.aiModel,
        temperature: org.aiTemperature,
        useOwnKeys: org.useOwnAiKeys,
    }
}

/**
 * Update AI model configuration
 */
export async function updateAiModelConfig(
    organizationId: string,
    config: {
        model?: string
        temperature?: number
    }
): Promise<void> {
    await prisma.organization.update({
        where: { id: organizationId },
        data: {
            aiModel: config.model,
            aiTemperature: config.temperature,
        },
    })
}

/**
 * Test API key validity
 */
export async function testApiKey(
    provider: 'openai' | 'anthropic' | 'gemini',
    apiKey: string
): Promise<{ valid: boolean; error?: string }> {
    try {
        if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            })
            return { valid: response.ok }
        }

        if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'test' }],
                }),
            })
            return { valid: response.ok || response.status === 400 } // 400 is ok, means auth worked
        }

        if (provider === 'gemini') {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
            )
            return { valid: response.ok }
        }

        return { valid: false, error: 'Unknown provider' }
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}
