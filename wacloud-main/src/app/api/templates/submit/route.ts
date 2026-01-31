import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { createWhatsAppCloudClient } from '@/lib/evolution-api/whatsapp-cloud'
import { z } from 'zod'

// Validation schema for template submission
const submitTemplateSchema = z.object({
    channelId: z.string(),
    name: z.string().min(1).max(512),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
    language: z.string().default('en'),
    components: z.array(z.object({
        type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
        format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        text: z.string().optional(),
        example: z.object({
            header_text: z.array(z.string()).optional(),
            body_text: z.array(z.array(z.string())).optional(),
        }).optional(),
        buttons: z.array(z.object({
            type: z.enum(['URL', 'PHONE_NUMBER', 'QUICK_REPLY']),
            text: z.string(),
            url: z.string().optional(),
            phone_number: z.string().optional(),
        })).optional(),
    })),
})

// POST - Submit template to Meta for approval
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
        const validationResult = submitTemplateSchema.safeParse(body)

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: validationResult.error.issues },
                { status: 400 }
            )
        }

        const data = validationResult.data

        // Get channel and verify it belongs to user's organization
        const channel = await prisma.channel.findFirst({
            where: {
                id: data.channelId,
                organizationId: dbUser.organizationId,
                connectionType: 'CLOUD_API',
            },
        })

        if (!channel) {
            return NextResponse.json(
                { error: 'Channel not found or not configured for Cloud API' },
                { status: 404 }
            )
        }

        if (!channel.phoneNumberId || !channel.wabaId) {
            return NextResponse.json(
                { error: 'Channel not properly configured. Phone number ID and WABA ID required.' },
                { status: 400 }
            )
        }

        // Create WhatsApp Cloud API client
        const client = createWhatsAppCloudClient({
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
            phoneNumberId: channel.phoneNumberId,
            businessAccountId: channel.wabaId,
        })

        // Submit template to Meta
        const metaResponse = await client.createTemplate({
            name: data.name,
            category: data.category,
            language: data.language,
            components: data.components as Array<{
                type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
                format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
                text?: string
                example?: { header_text?: string[]; body_text?: string[][] }
                buttons?: Array<{
                    type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY'
                    text: string
                    url?: string
                    phone_number?: string
                }>
            }>,
        })

        // Extract component data for storage
        const headerComponent = data.components.find(c => c.type === 'HEADER')
        const bodyComponent = data.components.find(c => c.type === 'BODY')
        const footerComponent = data.components.find(c => c.type === 'FOOTER')
        const buttonsComponent = data.components.find(c => c.type === 'BUTTONS')

        // Extract body variables ({{1}}, {{2}}, etc.)
        const bodyVariables: string[] = []
        if (bodyComponent?.text) {
            const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g)
            if (matches) {
                bodyVariables.push(...matches.map(m => m.replace(/[{}]/g, '')))
            }
        }

        // Create template record in database
        const template = await prisma.messageTemplate.create({
            data: {
                name: data.name,
                language: data.language,
                category: data.category,
                headerType: headerComponent?.format as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null,
                headerContent: headerComponent?.text || null,
                bodyText: bodyComponent?.text || '',
                bodyVariables,
                footerText: footerComponent?.text || null,
                buttons: (buttonsComponent?.buttons || null) as import('@prisma/client/runtime/library').InputJsonValue,
                waTemplateId: metaResponse.id,
                status: metaResponse.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
                channelId: channel.id,
            },
        })

        return NextResponse.json({
            data: {
                id: template.id,
                waTemplateId: metaResponse.id,
                name: template.name,
                status: metaResponse.status,
                message: 'Template submitted successfully. It may take up to 24 hours for Meta to review.',
            },
        })
    } catch (error) {
        console.error('Error submitting template:', error)

        // Handle Meta API errors
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
            const metaError = axiosError.response?.data?.error?.message

            return NextResponse.json(
                { error: metaError || 'Failed to submit template to Meta' },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: 'Failed to submit template' },
            { status: 500 }
        )
    }
}

// GET - Check template status from Meta
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
        const templateId = searchParams.get('templateId')

        if (!templateId) {
            return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
        }

        // Get template from database
        const template = await prisma.messageTemplate.findFirst({
            where: {
                id: templateId,
                channel: { organizationId: dbUser.organizationId },
            },
            include: { channel: true },
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        if (!template.waTemplateId) {
            return NextResponse.json({ error: 'Template not submitted to Meta yet' }, { status: 400 })
        }

        // Get status from Meta
        const client = createWhatsAppCloudClient({
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
            phoneNumberId: template.channel.phoneNumberId || '',
            businessAccountId: template.channel.wabaId || '',
        })

        const templates = await client.getTemplates()
        const metaTemplate = templates.data.find(t => t.id === template.waTemplateId)

        if (metaTemplate) {
            // Update local status if changed
            // Map Meta status to our enum (only update if it's a valid status in our schema)
            const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const
            type ValidStatus = typeof validStatuses[number]

            const mappedStatus: ValidStatus =
                metaTemplate.status === 'APPROVED' ? 'APPROVED' :
                    metaTemplate.status === 'REJECTED' ? 'REJECTED' :
                        'PENDING'

            if (mappedStatus !== template.status) {
                await prisma.messageTemplate.update({
                    where: { id: template.id },
                    data: { status: mappedStatus },
                })
            }

            return NextResponse.json({
                data: {
                    id: template.id,
                    name: metaTemplate.name,
                    status: metaTemplate.status,
                    category: metaTemplate.category,
                    language: metaTemplate.language,
                    components: metaTemplate.components,
                },
            })
        }

        return NextResponse.json({
            data: {
                id: template.id,
                name: template.name,
                status: template.status,
                message: 'Template status not found in Meta. It may still be processing.',
            },
        })
    } catch (error) {
        console.error('Error checking template status:', error)
        return NextResponse.json(
            { error: 'Failed to check template status' },
            { status: 500 }
        )
    }
}
