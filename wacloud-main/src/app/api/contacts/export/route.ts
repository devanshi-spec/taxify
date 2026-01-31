import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

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

        const { searchParams } = new URL(request.url)
        const format = searchParams.get('format') || 'csv' // csv or json
        const body = await request.json()

        const {
            filters = {},
            fields = ['name', 'phoneNumber', 'email', 'tags', 'stage', 'createdAt'],
        } = body

        // Build where clause
        const where: Record<string, unknown> = {
            organizationId: dbUser.organizationId,
        }

        if (filters.stage) {
            where.stage = filters.stage
        }

        if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
            where.tags = { hasSome: filters.tags }
        }

        if (filters.channelId) {
            where.channelId = filters.channelId
        }

        if (filters.createdAfter) {
            where.createdAt = { gte: new Date(filters.createdAfter) }
        }

        if (filters.createdBefore) {
            const existingCreatedAt = where.createdAt as { gte?: Date } | undefined
            where.createdAt = {
                ...(existingCreatedAt || {}),
                lte: new Date(filters.createdBefore),
            }
        }

        // Get contacts
        const contacts = await prisma.contact.findMany({
            where,
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                email: true,
                profileName: true,
                tags: true,
                stage: true,
                customFields: true,
                createdAt: true,
                lastContactedAt: true,
                channel: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        if (format === 'json') {
            // Return JSON format
            return NextResponse.json({
                data: contacts,
                count: contacts.length,
                exportedAt: new Date().toISOString(),
            })
        }

        // Generate CSV
        const csv = generateCSV(contacts, fields)

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="contacts-export-${Date.now()}.csv"`,
            },
        })
    } catch (error) {
        console.error('Error exporting contacts:', error)
        return NextResponse.json(
            { error: 'Failed to export contacts' },
            { status: 500 }
        )
    }
}

function generateCSV(
    contacts: Array<Record<string, unknown>>,
    fields: string[]
): string {
    // CSV header
    const header = fields.join(',')

    // CSV rows
    const rows = contacts.map((contact) => {
        return fields
            .map((field) => {
                let value = contact[field]

                // Handle special fields
                if (field === 'tags' && Array.isArray(value)) {
                    value = value.join(';')
                } else if (field === 'customFields' && typeof value === 'object') {
                    value = JSON.stringify(value)
                } else if (field === 'channel' && value && typeof value === 'object') {
                    value = (value as { name?: string }).name || ''
                } else if (value instanceof Date) {
                    value = value.toISOString()
                }

                // Escape CSV special characters
                const stringValue = String(value || '')
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`
                }
                return stringValue
            })
            .join(',')
    })

    return [header, ...rows].join('\n')
}
