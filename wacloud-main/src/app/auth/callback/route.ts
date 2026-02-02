import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/inbox'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if user exists in database
        const existingUser = await prisma.user.findUnique({
          where: { supabaseUserId: user.id },
        })

        if (!existingUser) {
          // Create organization and user for new signups
          const orgName = user.user_metadata?.name
            ? `${user.user_metadata.name}'s Organization`
            : 'My Organization'

          const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

          const organization = await prisma.organization.create({
            data: {
              name: orgName,
              slug: `${slug}-${Date.now()}`,
              billingEmail: user.email,
            },
          })

          await prisma.user.create({
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
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
