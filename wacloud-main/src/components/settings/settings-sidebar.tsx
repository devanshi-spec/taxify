'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  User,
  Users,
  Phone,
  CreditCard,
  Plug,
  Bell,
  Shield,
  Palette,
} from 'lucide-react'

const settingsNav = [
  {
    title: 'Account',
    items: [
      { name: 'Profile', href: '/settings/profile', icon: User },
      { name: 'Team', href: '/settings/team', icon: Users },
      { name: 'Notifications', href: '/settings/notifications', icon: Bell },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { name: 'Channels', href: '/settings/channels', icon: Phone },
      { name: 'Integrations', href: '/settings/integrations', icon: Plug },
    ],
  },
  {
    title: 'Billing',
    items: [
      { name: 'Plans & Billing', href: '/settings/billing', icon: CreditCard },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { name: 'Security', href: '/settings/security', icon: Shield },
      { name: 'Appearance', href: '/settings/appearance', icon: Palette },
    ],
  },
]

export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 border-r bg-card p-4">
      <nav className="space-y-6">
        {settingsNav.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
