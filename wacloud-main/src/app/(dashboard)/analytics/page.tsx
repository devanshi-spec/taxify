import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsPageContent } from '@/components/analytics/analytics-page-content'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userProfile = {
    name: user?.user_metadata?.name || null,
    email: user?.email || '',
    avatarUrl: user?.user_metadata?.avatar_url || null,
  }

  return (
    <div className="flex h-screen flex-col">
      <Header user={userProfile} title="Analytics" />
      <AnalyticsPageContent />
    </div>
  )
}
