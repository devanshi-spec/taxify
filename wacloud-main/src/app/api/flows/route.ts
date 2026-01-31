import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

const createFlowSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    flowJson: z.object({}).passthrough(), // WhatsApp Flow JSON schema
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
})

// GET: List all flows
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
        const status = searchParams.get('status')

        const where: Record<string, unknown> = {
            organizationId: dbUser.organizationId,
        }

        if (status) {
            where.status = status
        }

        const flows = await prisma.whatsAppFlow.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { responses: true },
                },
            },
        })

        return NextResponse.json({ data: flows })
    } catch (error) {
        console.error('Error fetching flows:', error)
        return NextResponse.json(
            { error: 'Failed to fetch flows' },
            { status: 500 }
        )
    }
}

// POST: Create a new flow
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
        const validatedData = createFlowSchema.parse(body)

        const flow = await prisma.whatsAppFlow.create({
            data: {
                name: validatedData.name,
                description: validatedData.description,
                flowJson: validatedData.flowJson as Prisma.InputJsonValue,
                category: validatedData.category,
                tags: validatedData.tags || [],
                organizationId: dbUser.organizationId,
            },
        })

        return NextResponse.json({ data: flow }, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error creating flow:', error)
        return NextResponse.json(
            { error: 'Failed to create flow' },
            { status: 500 }
        )
    }
}
