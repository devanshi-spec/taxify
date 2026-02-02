'use client'

import { useState, useEffect } from 'react'
import { Loader2, Megaphone, Plus, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Campaign {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  _count: { contacts: number }
}

interface CampaignPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  onAdded?: (campaignId: string) => void
}

export function CampaignPicker({
  open,
  onOpenChange,
  contactId,
  onAdded,
}: CampaignPickerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchCampaigns()
      setSelectedCampaign(null)
    }
  }, [open])

  const fetchCampaigns = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/campaigns?status=DRAFT')
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCampaign = async () => {
    if (!selectedCampaign) {
      toast.error('Please select a campaign')
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: [contactId] }),
      })

      if (response.ok) {
        const campaign = campaigns.find(c => c.id === selectedCampaign)
        toast.success(`Added to campaign: ${campaign?.name}`)
        onAdded?.(selectedCampaign)
        onOpenChange(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add to campaign')
      }
    } catch (error) {
      console.error('Failed to add to campaign:', error)
      toast.error('Failed to add to campaign')
    } finally {
      setIsAdding(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-500'
      case 'SCHEDULED': return 'bg-blue-500'
      case 'RUNNING': return 'bg-green-500'
      case 'PAUSED': return 'bg-yellow-500'
      case 'COMPLETED': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Add to Campaign
          </DialogTitle>
          <DialogDescription>
            Select a campaign to add this contact to
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto mb-2" />
              <p>No draft campaigns available</p>
              <p className="text-xs mt-1">Create a campaign first to add contacts</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <RadioGroup value={selectedCampaign || ''} onValueChange={setSelectedCampaign}>
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedCampaign(campaign.id)}
                  >
                    <RadioGroupItem value={campaign.id} id={campaign.id} />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={campaign.id} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{campaign.name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {campaign.type}
                          </Badge>
                        </div>
                        {campaign.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {campaign.description}
                          </p>
                        )}
                      </Label>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(campaign.status)}`} />
                        {campaign.status}
                      </div>
                      <p>{campaign._count.contacts} contacts</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToCampaign}
            disabled={isAdding || !selectedCampaign}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add to Campaign
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
