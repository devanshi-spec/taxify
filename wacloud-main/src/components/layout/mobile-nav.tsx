'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Menu,
    MessageSquare,
    Users,
    Send,
    Bot,
    LayoutDashboard,
    Settings,
    FileText,
    Briefcase,
    X,
} from 'lucide-react'

interface MobileNavProps {
    unreadCount?: number
}

const navigationItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'Inbox',
        href: '/inbox',
        icon: MessageSquare,
        badge: true,
    },
    {
        title: 'Contacts',
        href: '/contacts',
        icon: Users,
    },
    {
        title: 'Campaigns',
        href: '/campaigns',
        icon: Send,
    },
    {
        title: 'Chatbots',
        href: '/chatbots',
        icon: Bot,
    },
    {
        title: 'Deals',
        href: '/deals',
        icon: Briefcase,
    },
    {
        title: 'Templates',
        href: '/templates',
        icon: FileText,
    },
    {
        title: 'Automation',
        href: '/automation',
        icon: Bot,
    },
    {
        title: 'Billing',
        href: '/settings/billing',
        icon: Settings,
    },
    {
        title: 'Settings',
        href: '/settings/profile',
        icon: Settings,
    },
]

export function MobileNav({ unreadCount = 0 }: MobileNavProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Open menu"
                >
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b p-4">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <span className="font-semibold">Whatomate</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setOpen(false)}
                            className="h-8 w-8"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1">
                        <nav className="space-y-1 p-2">
                            {navigationItems.map((item) => {
                                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                                const Icon = item.icon

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={`
                      flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                      ${isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }
                    `}
                                    >
                                        <Icon className="h-5 w-5 shrink-0" />
                                        <span className="flex-1">{item.title}</span>
                                        {item.badge && unreadCount > 0 && (
                                            <Badge
                                                variant={isActive ? 'secondary' : 'default'}
                                                className="h-5 min-w-5 px-1.5 text-xs"
                                            >
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </Badge>
                                        )}
                                    </Link>
                                )
                            })}
                        </nav>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="border-t p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <Users className="h-5 w-5" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium">User Name</p>
                                <p className="truncate text-xs text-muted-foreground">user@example.com</p>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

/**
 * Mobile bottom navigation bar
 */
export function MobileBottomNav({ unreadCount = 0 }: MobileNavProps) {
    const pathname = usePathname()

    const bottomNavItems = [
        { title: 'Inbox', href: '/inbox', icon: MessageSquare, badge: true },
        { title: 'Contacts', href: '/contacts', icon: Users },
        { title: 'Campaigns', href: '/campaigns', icon: Send },
        { title: 'More', href: '/settings/profile', icon: Settings },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
            <nav className="flex items-center justify-around">
                {bottomNavItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                relative flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors
                ${isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                                }
              `}
                        >
                            <div className="relative">
                                <Icon className="h-5 w-5" />
                                {item.badge && unreadCount > 0 && (
                                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <span className="font-medium">{item.title}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

/**
 * Mobile header with back button
 */
interface MobileHeaderProps {
    title: string
    onBack?: () => void
    actions?: React.ReactNode
}

export function MobileHeader({ title, onBack, actions }: MobileHeaderProps) {
    return (
        <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
            {onBack && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="h-8 w-8"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
            <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
            {actions}
        </div>
    )
}

/**
 * Mobile-optimized card component
 */
interface MobileCardProps {
    children: React.ReactNode
    onClick?: () => void
    className?: string
}

export function MobileCard({ children, onClick, className = '' }: MobileCardProps) {
    return (
        <div
            onClick={onClick}
            className={`
        rounded-lg border bg-card p-4 transition-colors
        ${onClick ? 'active:bg-muted cursor-pointer' : ''}
        ${className}
      `}
        >
            {children}
        </div>
    )
}

/**
 * Mobile pull-to-refresh component
 */
interface PullToRefreshProps {
    onRefresh: () => Promise<void>
    children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
    const [pulling, setPulling] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [startY, setStartY] = useState(0)
    const [pullDistance, setPullDistance] = useState(0)

    const handleTouchStart = (e: React.TouchEvent) => {
        setStartY(e.touches[0].clientY)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentY = e.touches[0].clientY
        const distance = currentY - startY

        if (distance > 0 && window.scrollY === 0) {
            setPulling(true)
            setPullDistance(Math.min(distance, 100))
        }
    }

    const handleTouchEnd = async () => {
        if (pullDistance > 60 && !refreshing) {
            setRefreshing(true)
            await onRefresh()
            setRefreshing(false)
        }
        setPulling(false)
        setPullDistance(0)
    }

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative"
        >
            {(pulling || refreshing) && (
                <div
                    className="absolute left-0 right-0 top-0 flex items-center justify-center transition-all"
                    style={{ height: `${pullDistance}px` }}
                >
                    <div className={`${refreshing ? 'animate-spin' : ''}`}>
                        ↻
                    </div>
                </div>
            )}
            <div style={{ transform: `translateY(${pullDistance}px)` }}>
                {children}
            </div>
        </div>
    )
}
