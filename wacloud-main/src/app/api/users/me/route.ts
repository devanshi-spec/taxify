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
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ data: dbUser })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
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
    const { name, avatarUrl } = body

    const updatedUser = await prisma.user.update({
      where: { supabaseUserId: user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    })

    return NextResponse.json({ data: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
