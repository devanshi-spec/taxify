import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        select: { organizationId: true }
    })

    if (!dbUser?.organizationId) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const rules = await prisma.automationRule.findMany({
        where: { organizationId: dbUser.organizationId },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: rules })
}

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        select: { organizationId: true }
    })

    if (!dbUser?.organizationId) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, triggerType, actionType, triggerConfig, actionConfig } = body

    if (!name || !triggerType || !actionType) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const rule = await prisma.automationRule.create({
        data: {
            name,
            triggerType,
            actionType,
            triggerConfig: triggerConfig || {},
            actionConfig: actionConfig || {},
            organizationId: dbUser.organizationId
        }
    })

    return NextResponse.json({ data: rule })
}
