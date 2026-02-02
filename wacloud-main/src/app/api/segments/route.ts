import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// GET all segments (distinct segment values from contacts + saved segments)
export async function GET() {
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

    if (!dbUser?.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get distinct segments from contacts
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: dbUser.organizationId,
        segment: { not: null },
      },
      select: { segment: true },
      distinct: ['segment'],
    })

    const segments = contacts
      .map((c) => c.segment)
      .filter((s): s is string => !!s)
      .sort()

    // Add some default segments if none exist
    const defaultSegments = ['VIP Customers', 'New Leads', 'Active Users', 'Churned', 'Hot Leads']
    const allSegments = [...new Set([...segments, ...defaultSegments])]

    return NextResponse.json({
      data: allSegments.map((name, index) => ({
        id: `segment-${index}`,
        name,
        count: contacts.filter(c => c.segment === name).length,
      })),
    })
  } catch (error) {
    console.error('Error fetching segments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch segments' },
      { status: 500 }
    )
  }
}

// POST - assign contacts to segment
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

    if (!dbUser?.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { contactIds, segment } = body

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    // Update contacts with the segment
    const result = await prisma.contact.updateMany({
      where: {
        id: { in: contactIds },
        organizationId: dbUser.organizationId,
      },
      data: { segment },
    })

    return NextResponse.json({
      success: true,
      updated: result.count,
      message: segment
        ? `${result.count} contacts added to "${segment}"`
        : `${result.count} contacts removed from segment`,
    })
  } catch (error) {
    console.error('Error assigning segment:', error)
    return NextResponse.json(
      { error: 'Failed to assign segment' },
      { status: 500 }
    )
  }
}
