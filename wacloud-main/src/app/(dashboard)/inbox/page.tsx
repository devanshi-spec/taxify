import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/server'
import { InboxWrapper } from '@/components/inbox/inbox-wrapper'
import { prisma } from '@/lib/db'

export default async function InboxPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userProfile = {
    name: user?.user_metadata?.name || null,
    email: user?.email || '',
    avatarUrl: user?.user_metadata?.avatar_url || null,
  }

  // Get user's organization
  let organizationId: string | undefined
  if (user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { organizationId: true },
    })
    organizationId = dbUser?.organizationId
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header user={userProfile} title="Inbox" />

      <InboxWrapper
        userId={user?.id || ''}
        userName={user?.user_metadata?.name || null}
        organizationId={organizationId}
      />
    </div>
  )
}
