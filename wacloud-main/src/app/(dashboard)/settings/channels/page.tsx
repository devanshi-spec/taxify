import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/server'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'
import { ChannelsSettings } from '@/components/settings/channels-settings'

export default async function ChannelsSettingsPage() {
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
      <Header user={userProfile} title="Settings" />

      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar />
        <div className="flex-1 overflow-auto p-6">
          <ChannelsSettings />
        </div>
      </div>
    </div>
  )
}
