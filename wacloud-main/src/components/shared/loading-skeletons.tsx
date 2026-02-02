'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for conversation list items
 */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2 p-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[140px]" />
                        <Skeleton className="h-3 w-[200px]" />
                    </div>
                    <Skeleton className="h-3 w-12" />
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for contact list items
 */
export function ContactListSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="space-y-2 p-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[180px]" />
                        <Skeleton className="h-3 w-[120px]" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for message bubbles
 */
export function MessageListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-4 p-4">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                >
                    <div className={`max-w-[70%] space-y-1 ${i % 2 === 0 ? '' : 'items-end'}`}>
                        <Skeleton
                            className={`h-16 rounded-2xl ${i % 2 === 0 ? 'w-[250px]' : 'w-[200px]'}`}
                        />
                        <Skeleton className="h-2 w-12" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for campaign list
 */
export function CampaignListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-[140px]" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-[80%]" />
                    <div className="flex gap-4 pt-2">
                        <div className="space-y-1">
                            <Skeleton className="h-6 w-12" />
                            <Skeleton className="h-2 w-8" />
                        </div>
                        <div className="space-y-1">
                            <Skeleton className="h-6 w-12" />
                            <Skeleton className="h-2 w-8" />
                        </div>
                        <div className="space-y-1">
                            <Skeleton className="h-6 w-12" />
                            <Skeleton className="h-2 w-8" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for deals kanban board
 */
export function DealsKanbanSkeleton({ columns = 4 }: { columns?: number }) {
    return (
        <div className="flex gap-4 overflow-x-auto p-4">
            {Array.from({ length: columns }).map((_, col) => (
                <div key={col} className="min-w-[280px] space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-5 w-8 rounded-full" />
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: 3 - col % 2 }).map((_, i) => (
                            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                                <Skeleton className="h-4 w-[160px]" />
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                    <Skeleton className="h-3 w-[80px]" />
                                </div>
                                <div className="flex justify-between">
                                    <Skeleton className="h-3 w-[60px]" />
                                    <Skeleton className="h-3 w-[50px]" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for chatbot list
 */
export function ChatbotListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-[120px]" />
                            <Skeleton className="h-3 w-[80px]" />
                        </div>
                        <Skeleton className="h-6 w-12 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-[70%]" />
                    <div className="flex gap-2 pt-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for analytics cards
 */
export function AnalyticsCardsSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-8 w-8 rounded" />
                    </div>
                    <Skeleton className="h-8 w-[80px]" />
                    <Skeleton className="h-3 w-[60px]" />
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for table rows
 */
export function TableRowsSkeleton({
    rows = 5,
    columns = 5
}: {
    rows?: number
    columns?: number
}) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, row) => (
                <div key={row} className="flex items-center gap-4 rounded border-b p-4">
                    {Array.from({ length: columns }).map((_, col) => (
                        <Skeleton
                            key={col}
                            className={`h-4 ${col === 0 ? 'w-[200px]' : 'w-[100px]'}`}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for settings page
 */
export function SettingsSkeleton() {
    return (
        <div className="space-y-6 p-6">
            <div className="space-y-2">
                <Skeleton className="h-6 w-[200px]" />
                <Skeleton className="h-4 w-[300px]" />
            </div>
            <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-10 w-full max-w-md" />
                    </div>
                ))}
            </div>
            <Skeleton className="h-10 w-[120px]" />
        </div>
    )
}
