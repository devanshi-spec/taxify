import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getCampaignService } from '@/lib/services/campaign-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify campaign belongs to user's organization
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action || 'start'

    const campaignService = getCampaignService()

    switch (action) {
      case 'start':
        // Execute campaign (runs in background)
        const result = await campaignService.executeCampaign(id)
        return NextResponse.json({ data: result })

      case 'pause':
        await campaignService.pauseCampaign(id)
        return NextResponse.json({ success: true, message: 'Campaign paused' })

      case 'resume':
        const resumeResult = await campaignService.resumeCampaign(id)
        return NextResponse.json({ data: resumeResult })

      case 'cancel':
        await campaignService.cancelCampaign(id)
        return NextResponse.json({ success: true, message: 'Campaign cancelled' })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, pause, resume, or cancel' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error executing campaign:', error)
    return NextResponse.json(
      { error: 'Failed to execute campaign' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify campaign belongs to user's organization
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get campaign stats
    const campaignService = getCampaignService()
    const stats = await campaignService.getCampaignStats(id)

    return NextResponse.json({
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt,
        },
        stats,
      },
    })
  } catch (error) {
    console.error('Error fetching campaign stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign stats' },
      { status: 500 }
    )
  }
}
