'use client'

import { useState } from 'react'
import { Bell, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ContactDialog } from '@/components/contacts/contact-dialog'
import { CampaignDialog } from '@/components/campaigns/campaign-dialog'
import { ChatbotDialog } from '@/components/chatbots/chatbot-dialog'
import { ChannelDialog } from '@/components/channels/channel-dialog'

interface HeaderProps {
  user?: {
    name: string | null
    email: string
    avatarUrl: string | null
  }
  title?: string
}

export function Header({ user, title }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false)
  const [chatbotDialogOpen, setChatbotDialogOpen] = useState(false)
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        {title && <h1 className="text-xl font-semibold">{title}</h1>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts, messages..."
            className="w-64 pl-9"
          />
        </div>

        {/* Quick actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild id="header-quick-actions">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setContactDialogOpen(true)}>
              New Contact
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCampaignDialogOpen(true)}>
              New Campaign
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChatbotDialogOpen(true)}>
              New Chatbot
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChannelDialogOpen(true)}>
              Connect Channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
            3
          </Badge>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild id="header-user-menu">
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback>
                  {user?.name?.[0] || user?.email?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/channels')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/team')}>
              Team
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/integrations')}>
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        onSuccess={() => router.refresh()}
      />
      <CampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        onSuccess={() => router.push('/campaigns')}
      />
      <ChatbotDialog
        open={chatbotDialogOpen}
        onOpenChange={setChatbotDialogOpen}
        onSuccess={() => router.push('/chatbots')}
      />
      <ChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        onSuccess={() => router.push('/settings/channels')}
      />
    </header>
  )
}
