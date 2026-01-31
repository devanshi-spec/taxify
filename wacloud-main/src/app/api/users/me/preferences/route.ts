import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Default preferences
    const defaultPreferences = {
      notifications: {
        emailNewMessage: true,
        emailNewConversation: true,
        emailDailySummary: false,
        emailWeeklyReport: true,
        pushNewMessage: true,
        pushMentions: true,
        pushAssignments: true,
        soundEnabled: true,
        desktopNotifications: true,
      },
      appearance: {
        theme: 'system',
        accentColor: 'green',
        fontSize: 'medium',
        compactMode: false,
        showAvatars: true,
        animationsEnabled: true,
      },
    }

    // In a production app, you'd fetch from a preferences table
    return NextResponse.json({ data: defaultPreferences })
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // In a production app, you'd save to a preferences table
    console.log('Saving preferences for user:', user.id, body)

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      data: body
    })
  } catch (error) {
    console.error('Error saving preferences:', error)
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}
