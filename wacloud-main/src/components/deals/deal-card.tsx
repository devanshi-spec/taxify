'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar, MessageSquare, User } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'

interface Deal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  assignedTo: string | null
  contact: {
    id: string
    name: string | null
    phoneNumber: string
    avatarUrl: string | null
  }
  assignedUser?: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
  customFields?: Record<string, unknown> | null
  _count?: {
    activities: number
  }
  createdAt: string
}

interface DealCardProps {
  deal: Deal
  onClick?: () => void
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={
        `cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative overflow-hidden group 
        ${(deal.customFields as any)?.aiWinProbability > 80 ? 'border-violet-500/50 dark:border-violet-400/50 shadow-violet-100 dark:shadow-none' : ''}`
      }
      onClick={onClick}
    >
      {/* AI Glow Effect for high probability deals */}
      {(deal.customFields as any)?.aiWinProbability > 80 && (
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
      )}

      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 pl-2">
          <h4 className="font-medium text-sm line-clamp-2">{deal.title}</h4>
          <Badge
            variant={(deal.customFields as any)?.aiWinProbability > 70 ? 'default' : 'secondary'}
            className={(deal.customFields as any)?.aiWinProbability > 70 ? 'bg-violet-600 hover:bg-violet-700' : ''}
          >
            {deal.probability}%
          </Badge>
        </div>

        <div className="text-lg font-bold text-primary pl-2">
          {formatCurrency(deal.value, deal.currency)}
        </div>

        <div className="flex items-center justify-between gap-2 pl-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={deal.contact.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(deal.contact.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {deal.contact.name || deal.contact.phoneNumber}
            </span>
          </div>
          {deal.assignedUser && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-5 w-5 shrink-0 border-2 border-background ring-2 ring-primary/20">
                    <AvatarImage src={deal.assignedUser.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                      {getInitials(deal.assignedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assigned to {deal.assignedUser.name || deal.assignedUser.email}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t pl-2">
          <div className="flex items-center gap-2">
            {deal.expectedCloseDate ? (
              <div className="flex items-center gap-1" title="Expected close date">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(new Date(deal.expectedCloseDate), { addSuffix: true })}
              </div>
            ) : (
              <span>No close date</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* AI Indicators */}
            {(deal.customFields as any)?.aiWinProbability && (
              <div className="flex items-center gap-1 text-violet-600 font-medium animate-pulse" title="AI Win Probability">
                <span className="text-[10px]">AI Score:</span>
                <span className="text-xs">{(deal.customFields as any).aiWinProbability}%</span>
              </div>
            )}

            {deal._count?.activities ? (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {deal._count.activities}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
