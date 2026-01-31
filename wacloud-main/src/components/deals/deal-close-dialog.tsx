'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Trophy, XCircle, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type CloseOutcome = 'WON' | 'LOST' | 'ABANDONED'

interface DealCloseDialogProps {
  dealId: string
  dealTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const LOSS_REASONS = [
  'Price too high',
  'Chose competitor',
  'Budget constraints',
  'Timing not right',
  'No decision made',
  'Requirements changed',
  'Contact unresponsive',
  'Other',
]

const WIN_REASONS = [
  'Best price',
  'Best features',
  'Strong relationship',
  'Fast implementation',
  'Better support',
  'Other',
]

export function DealCloseDialog({
  dealId,
  dealTitle,
  open,
  onOpenChange,
  onSuccess,
}: DealCloseDialogProps) {
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState<CloseOutcome>('WON')
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const handleSubmit = async () => {
    try {
      setLoading(true)

      // Update deal with close info
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closedReason: `${outcome}: ${reason}${notes ? ` - ${notes}` : ''}`,
          stage: outcome === 'WON' ? 'closed' : 'lost',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to close deal')
      }

      // Log activity
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          type: 'NOTE',
          title: `Deal ${outcome === 'WON' ? 'Won' : outcome === 'LOST' ? 'Lost' : 'Abandoned'}`,
          description: `Outcome: ${outcome}\nReason: ${reason}${notes ? `\nNotes: ${notes}` : ''}`,
        }),
      })

      toast.success(`Deal marked as ${outcome.toLowerCase()}`)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error closing deal:', error)
      toast.error('Failed to close deal')
    } finally {
      setLoading(false)
    }
  }

  const outcomeConfig = {
    WON: {
      icon: Trophy,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500',
      description: 'The deal was successful',
    },
    LOST: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500',
      description: 'The deal was lost to competition or rejected',
    },
    ABANDONED: {
      icon: Ban,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500',
      description: 'The deal was abandoned or canceled',
    },
  }

  const reasons = outcome === 'WON' ? WIN_REASONS : LOSS_REASONS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Deal</DialogTitle>
          <DialogDescription>
            Record the outcome for "{dealTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Outcome Selection */}
          <div className="space-y-3">
            <Label>Outcome</Label>
            <RadioGroup
              value={outcome}
              onValueChange={(value) => {
                setOutcome(value as CloseOutcome)
                setReason('')
              }}
              className="grid grid-cols-3 gap-3"
            >
              {(['WON', 'LOST', 'ABANDONED'] as const).map((value) => {
                const config = outcomeConfig[value]
                const Icon = config.icon
                const isSelected = outcome === value
                return (
                  <div key={value}>
                    <RadioGroupItem
                      value={value}
                      id={value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={value}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent',
                        isSelected
                          ? cn(config.borderColor, config.bgColor)
                          : 'border-muted hover:border-muted-foreground/50'
                      )}
                    >
                      <Icon className={cn('h-6 w-6 mb-2', isSelected ? config.color : 'text-muted-foreground')} />
                      <span className={cn('font-medium', isSelected && config.color)}>
                        {value === 'WON' ? 'Won' : value === 'LOST' ? 'Lost' : 'Abandoned'}
                      </span>
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {outcomeConfig[outcome].description}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>{outcome === 'WON' ? 'Win Reason' : 'Loss Reason'}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional Notes (optional)</Label>
            <Textarea
              placeholder="Add any additional context about this outcome..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason}
            className={cn(
              outcome === 'WON' && 'bg-green-600 hover:bg-green-700',
              outcome === 'LOST' && 'bg-red-600 hover:bg-red-700',
              outcome === 'ABANDONED' && 'bg-gray-600 hover:bg-gray-700'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing...
              </>
            ) : (
              `Mark as ${outcome === 'WON' ? 'Won' : outcome === 'LOST' ? 'Lost' : 'Abandoned'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
