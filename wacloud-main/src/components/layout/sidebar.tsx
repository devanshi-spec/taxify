'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Users,
  Megaphone,
  Bot,
  BarChart3,
  Settings,
  Phone,
  ChevronLeft,
  ChevronRight,
  Kanban,
  FileText,
  ShoppingBag,
  Workflow,
  Timer,
  UserCog,
  LayoutGrid,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'

// Organized Navigation Groups
const navigationGroups = [
  {
    title: "Connect",
    items: [
      { name: 'Inbox', href: '/inbox', icon: MessageSquare },
      { name: 'Contacts', href: '/contacts', icon: Users },
      { name: 'Team', href: '/settings/team', icon: UserCog },
    ]
  },
  {
    title: "Sell",
    items: [
      { name: 'Deals', href: '/deals', icon: Kanban },
      { name: 'Products', href: '/products', icon: ShoppingBag },
    ]
  },
  {
    title: "Grow",
    items: [
      { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { name: 'Sequences', href: '/drip-campaigns', icon: Timer },
    ]
  },
  {
    title: "Automate",
    items: [
      { name: 'Chatbots', href: '/chatbots', icon: Bot },
      { name: 'Automation Rules', href: '/automation', icon: Workflow },
      { name: 'WhatsApp Screens', href: '/flows', icon: Workflow },
      { name: 'Templates', href: '/templates', icon: FileText },
    ]
  },
  {
    title: "Analyzes",
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    ]
  }
]

const adminGroup = {
  title: "Administration",
  items: [
    { name: 'Super Admin', href: '/admin', icon: UserCog },
  ]
}

const settingsNavigation = [
  { name: 'General Settings', href: '/settings/profile', icon: Settings },
  { name: 'Billing', href: '/settings/billing', icon: ShoppingBag },
  { name: 'Channels', href: '/settings/channels', icon: Phone },
  { name: 'Team', href: '/settings/team', icon: Users },
  { name: 'Knowledge Base', href: '/settings/knowledge-base', icon: BookOpen },
]

interface SidebarProps {
  user?: {
    name: string | null
    email: string
    avatarUrl: string | null
    role?: string
    isSuperAdmin?: boolean
  }
  organization?: {
    name: string
  }
}

export function Sidebar({ user, organization }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider>
      <div
        className={cn(
          'group flex h-screen flex-col border-r bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4 transition-all overflow-hidden">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold truncate">{organization?.name || 'WhatsApp CRM'}</span>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("shrink-0", collapsed && "hidden group-hover:block absolute right-[-10px]")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 py-4">
            {navigationGroups.map((group) => (
              <div key={group.title} className="px-3">
                {!collapsed && (
                  <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    const NavLink = (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          collapsed && 'justify-center px-2'
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    )

                    if (collapsed) {
                      return (
                        <Tooltip key={item.name} delayDuration={0}>
                          <TooltipTrigger asChild>{NavLink}</TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{group.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return NavLink
                  })}
                </div>
                {!collapsed && <div className="mt-4 border-b border-border/50" />}
              </div>
            ))}

            {/* Admin Group */}
            {user?.isSuperAdmin && (
              <div className="px-3 mt-4">
                {!collapsed && (
                  <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {adminGroup.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {adminGroup.items.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-destructive/10 text-destructive'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          collapsed && 'justify-center px-2'
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    )
                  })}
                </div>
                {!collapsed && <div className="mt-4 border-b border-border/50" />}
              </div>
            )}

            {/* Settings Group */}
            <div className="px-3 mt-4">
              {!collapsed && (
                <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Configuration
                </h3>
              )}
              <div className="space-y-1">
                {settingsNavigation.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  const NavLink = (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.name} delayDuration={0}>
                        <TooltipTrigger asChild>{NavLink}</TooltipTrigger>
                        <TooltipContent side="right">{item.name}</TooltipContent>
                      </Tooltip>
                    )
                  }
                  return NavLink
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* User section */}
        <div className="border-t p-2">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg p-2 hover:bg-accent/50 transition-colors cursor-pointer',
              collapsed && 'justify-center'
            )}
          >
            <Avatar className="h-8 w-8 border">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback>
                {user?.name?.[0] || user?.email?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">
                  {user?.name || 'User'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            )}
            {!collapsed && <Settings className="h-4 w-4 text-muted-foreground opacity-50" />}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
