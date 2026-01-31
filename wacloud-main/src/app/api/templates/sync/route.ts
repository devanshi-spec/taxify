import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getTemplateService } from '@/lib/services/template-service'

// POST - Sync templates from Meta
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
    const { channelId } = body

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    const templateService = getTemplateService()
    const result = await templateService.syncTemplates(channelId)

    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Error syncing templates:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync templates' },
      { status: 500 }
    )
  }
}
