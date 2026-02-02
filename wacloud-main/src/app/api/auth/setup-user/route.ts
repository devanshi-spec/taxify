import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      include: { organization: true },
    })

    if (existingUser) {
      return NextResponse.json({
        data: {
          user: existingUser,
          organization: existingUser.organization
        }
      })
    }

    // Get organization name from request or user metadata
    const body = await request.json().catch(() => ({}))
    const organizationName = body.organizationName
      || user.user_metadata?.organization_name
      || (user.user_metadata?.name ? `${user.user_metadata.name}'s Organization` : 'My Organization')

    // Create slug from organization name
    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: `${slug}-${Date.now()}`,
        billingEmail: user.email,
      },
    })

    // Create user (using Supabase UUID as both id and supabaseUserId for consistency)
    const newUser = await prisma.user.create({
      data: {
        id: user.id,
        supabaseUserId: user.id,
        email: user.email!,
        name: user.user_metadata?.name || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        organizationId: organization.id,
        role: 'OWNER',
      },
    })

    return NextResponse.json({
      data: {
        user: newUser,
        organization
      }
    })
  } catch (error) {
    console.error('Error setting up user:', error)
    return NextResponse.json(
      { error: 'Failed to setup user' },
      { status: 500 }
    )
  }
}
