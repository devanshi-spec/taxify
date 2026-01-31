import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const addContactsSchema = z.object({
  contactIds: z.array(z.string()).min(1),
})

// GET - List contacts in a campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
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

    // Verify campaign belongs to organization
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { campaignId }
    if (status) {
      where.status = status
    }

    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
              avatarUrl: true,
              stage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaignContact.count({ where }),
    ])

    return NextResponse.json({
      data: contacts,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching campaign contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign contacts' },
      { status: 500 }
    )
  }
}

// POST - Add contacts to a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
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

    // Verify campaign belongs to organization
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Only allow adding contacts to draft campaigns
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only add contacts to draft campaigns' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = addContactsSchema.parse(body)

    // Verify all contacts belong to the organization
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: validatedData.contactIds },
        organizationId: dbUser.organizationId,
        isOptedIn: true, // Only add opted-in contacts
      },
      select: { id: true },
    })

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found' },
        { status: 400 }
      )
    }

    // Get existing contacts in campaign to avoid duplicates
    const existingContacts = await prisma.campaignContact.findMany({
      where: {
        campaignId,
        contactId: { in: contacts.map(c => c.id) },
      },
      select: { contactId: true },
    })

    const existingIds = new Set(existingContacts.map(c => c.contactId))
    const newContacts = contacts.filter(c => !existingIds.has(c.id))

    if (newContacts.length === 0) {
      return NextResponse.json(
        { error: 'All contacts are already in this campaign' },
        { status: 400 }
      )
    }

    // Add contacts to campaign
    await prisma.campaignContact.createMany({
      data: newContacts.map(contact => ({
        campaignId,
        contactId: contact.id,
        status: 'PENDING',
      })),
    })

    // Update campaign total recipients count
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalRecipients: { increment: newContacts.length },
      },
    })

    return NextResponse.json({
      success: true,
      added: newContacts.length,
      skipped: contacts.length - newContacts.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error adding contacts to campaign:', error)
    return NextResponse.json(
      { error: 'Failed to add contacts to campaign' },
      { status: 500 }
    )
  }
}

// DELETE - Remove contacts from a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
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

    // Verify campaign belongs to organization
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Only allow removing contacts from draft campaigns
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only remove contacts from draft campaigns' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const deleted = await prisma.campaignContact.deleteMany({
      where: {
        campaignId,
        contactId,
      },
    })

    if (deleted.count > 0) {
      // Update campaign total recipients count
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalRecipients: { decrement: deleted.count },
        },
      })
    }

    return NextResponse.json({ success: true, removed: deleted.count })
  } catch (error) {
    console.error('Error removing contact from campaign:', error)
    return NextResponse.json(
      { error: 'Failed to remove contact from campaign' },
      { status: 500 }
    )
  }
}
