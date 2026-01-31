import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    })

    if (!dbUser?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const pipelineId = searchParams.get('pipelineId')

    if (!pipelineId) {
      return NextResponse.json({ error: 'Pipeline ID required' }, { status: 400 })
    }

    // Get pipeline with stages
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    const stages = pipeline.stages as Array<{
      id: string
      name: string
      color: string
      order: number
    }>

    // Get all deals for this pipeline
    const deals = await prisma.deal.findMany({
      where: {
        pipelineId,
        organizationId: dbUser.organizationId,
      },
      select: {
        id: true,
        value: true,
        stage: true,
        assignedTo: true,
        closedAt: true,
        closedReason: true,
        createdAt: true,
      },
    })

    // Calculate current month boundaries
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Filter deals
    const openDeals = deals.filter((d) => !d.closedAt)
    const closedThisMonth = deals.filter(
      (d) =>
        d.closedAt &&
        new Date(d.closedAt) >= startOfMonth &&
        new Date(d.closedAt) <= endOfMonth
    )

    const wonThisMonth = closedThisMonth.filter((d) =>
      d.closedReason?.startsWith('WON')
    )
    const lostThisMonth = closedThisMonth.filter(
      (d) =>
        d.closedReason?.startsWith('LOST') ||
        d.closedReason?.startsWith('ABANDONED')
    )

    // Calculate total pipeline value (open deals only)
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0)

    // Calculate conversion rate (won / (won + lost) this month)
    const totalClosed = wonThisMonth.length + lostThisMonth.length
    const conversionRate = totalClosed > 0
      ? (wonThisMonth.length / totalClosed) * 100
      : 0

    // Calculate average deal value
    const avgDealValue = openDeals.length > 0
      ? totalPipelineValue / openDeals.length
      : 0

    // Calculate average days to close
    const closedDeals = deals.filter((d) => d.closedAt)
    const avgDaysToClose = closedDeals.length > 0
      ? closedDeals.reduce((sum, d) => {
          const created = new Date(d.createdAt)
          const closed = new Date(d.closedAt!)
          const days = Math.ceil(
            (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + days
        }, 0) / closedDeals.length
      : 0

    // My deals count
    const myDeals = openDeals.filter((d) => d.assignedTo === user.id).length

    // Team deals (all open deals)
    const teamDeals = openDeals.length

    // Stage distribution (only open deals)
    const stageDistribution = stages
      .sort((a, b) => a.order - b.order)
      .map((stage) => {
        const stageDeals = openDeals.filter((d) => d.stage === stage.id)
        return {
          stage: stage.id,
          stageName: stage.name,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, d) => sum + d.value, 0),
          color: stage.color,
        }
      })

    return NextResponse.json({
      data: {
        totalPipelineValue,
        openDeals: openDeals.length,
        wonThisMonth: {
          count: wonThisMonth.length,
          value: wonThisMonth.reduce((sum, d) => sum + d.value, 0),
        },
        lostThisMonth: {
          count: lostThisMonth.length,
          value: lostThisMonth.reduce((sum, d) => sum + d.value, 0),
        },
        conversionRate,
        avgDealValue,
        avgDaysToClose,
        myDeals,
        teamDeals,
        stageDistribution,
      },
    })
  } catch (error) {
    console.error('Error fetching deal stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deal stats' },
      { status: 500 }
    )
  }
}
