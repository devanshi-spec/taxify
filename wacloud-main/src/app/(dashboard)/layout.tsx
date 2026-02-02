import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

// Cast prisma to any to avoid type errors
const db = prisma as any

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile from database
  const dbUser = await db.user.findUnique({
    where: { supabaseUserId: user.id },
    include: { organization: true }
  })

  if (!dbUser) {
    // Handle edge case where auth exists but db user doesn't
    return redirect('/onboarding')
  }

  const userProfile = {
    name: dbUser.name || null,
    email: dbUser.email || '',
    avatarUrl: dbUser.avatarUrl || null,
    role: dbUser.role,
    isSuperAdmin: dbUser.isSuperAdmin
  }

  const organization = {
    name: dbUser.organization.name,
    plan: dbUser.organization.plan
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={userProfile} organization={organization} />
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
