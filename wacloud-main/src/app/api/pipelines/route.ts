import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// Default pipeline stages
const DEFAULT_STAGES = [
  { id: 'new', name: 'New Lead', order: 0, color: '#6366f1', probability: 10 },
  { id: 'contacted', name: 'Contacted', order: 1, color: '#8b5cf6', probability: 25 },
  { id: 'qualified', name: 'Qualified', order: 2, color: '#0ea5e9', probability: 50 },
  { id: 'proposal', name: 'Proposal', order: 3, color: '#f59e0b', probability: 75 },
  { id: 'negotiation', name: 'Negotiation', order: 4, color: '#ec4899', probability: 90 },
  { id: 'closed', name: 'Closed Won', order: 5, color: '#22c55e', probability: 100 },
  { id: 'lost', name: 'Lost', order: 6, color: '#ef4444', probability: 0 },
]

// GET - List pipelines
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

    const pipelines = await prisma.pipeline.findMany({
      where: { organizationId: dbUser.organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { deals: true } },
      },
    })

    // If no pipelines exist, create a default one
    if (pipelines.length === 0) {
      const defaultPipeline = await prisma.pipeline.create({
        data: {
          name: 'Sales Pipeline',
          stages: DEFAULT_STAGES,
          isDefault: true,
          organizationId: dbUser.organizationId,
        },
        include: {
          _count: { select: { deals: true } },
        },
      })

      return NextResponse.json({ data: [defaultPipeline] })
    }

    return NextResponse.json({ data: pipelines })
  } catch (error) {
    console.error('Error fetching pipelines:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipelines' },
      { status: 500 }
    )
  }
}

// POST - Create pipeline
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
    const { name, stages } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // If this is the first pipeline, make it default
    const existingCount = await prisma.pipeline.count({
      where: { organizationId: dbUser.organizationId },
    })

    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        stages: stages || DEFAULT_STAGES,
        isDefault: existingCount === 0,
        organizationId: dbUser.organizationId,
      },
      include: {
        _count: { select: { deals: true } },
      },
    })

    return NextResponse.json({ data: pipeline }, { status: 201 })
  } catch (error) {
    console.error('Error creating pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to create pipeline' },
      { status: 500 }
    )
  }
}
