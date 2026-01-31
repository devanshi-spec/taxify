import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/db'

// GET /api/admin/platform-settings - List all platform settings (super admin only)
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is super admin
        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { isSuperAdmin: true }
        })

        if (!dbUser?.isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const settings = await prisma.platformSettings.findMany({
            orderBy: { key: 'asc' },
        })

        // Mask secret values
        const maskedSettings = settings.map(s => ({
            ...s,
            value: s.isSecret ? '' : s.value, // Don't send secret values to client
        }))

        return NextResponse.json({ settings: maskedSettings })
    } catch (error) {
        console.error('Error fetching platform settings:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/admin/platform-settings - Update platform settings
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is super admin
        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { isSuperAdmin: true }
        })

        if (!dbUser?.isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { settings } = body

        if (!settings || typeof settings !== 'object') {
            return NextResponse.json({ error: 'Invalid settings object' }, { status: 400 })
        }

        // Update each setting
        const updates = Object.entries(settings).map(([key, value]) =>
            prisma.platformSettings.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value), isSecret: key.includes('key') || key.includes('secret') },
            })
        )

        await Promise.all(updates)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating platform settings:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
