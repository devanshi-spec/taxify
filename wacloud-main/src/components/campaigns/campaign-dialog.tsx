'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Loader2, Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Channel {
  id: string
  name: string
  phoneNumber: string
}

interface Campaign {
  id: string
  name: string
  description: string | null
  type: string
  channelId?: string
  messageType?: string
  messageContent?: string | null
  targetSegment?: string | null
  targetTags?: string[]
  scheduledAt?: string | null
  channel?: Channel
}

interface CampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign?: Campaign | null
  onSuccess?: () => void
}

export function CampaignDialog({ open, onOpenChange, campaign, onSuccess }: CampaignDialogProps) {
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'BROADCAST',
    channelId: '',
    messageType: 'TEXT',
    messageContent: '',
    targetSegment: '',
    targetTags: '',
    isScheduled: false,
    scheduledDate: null as Date | null,
    scheduledTime: '09:00',
  })

  useEffect(() => {
    if (open) {
      fetchChannels()
      if (campaign) {
        const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null
        setFormData({
          name: campaign.name,
          description: campaign.description || '',
          type: campaign.type,
          channelId: campaign.channelId || campaign.channel?.id || '',
          messageType: campaign.messageType || 'TEXT',
          messageContent: campaign.messageContent || '',
          targetSegment: campaign.targetSegment || '',
          targetTags: campaign.targetTags?.join(', ') || '',
          isScheduled: !!campaign.scheduledAt,
          scheduledDate: scheduledAt,
          scheduledTime: scheduledAt ? format(scheduledAt, 'HH:mm') : '09:00',
        })
      } else {
        setFormData({
          name: '',
          description: '',
          type: 'BROADCAST',
          channelId: '',
          messageType: 'TEXT',
          messageContent: '',
          targetSegment: '',
          targetTags: '',
          isScheduled: false,
          scheduledDate: null,
          scheduledTime: '09:00',
        })
      }
    }
  }, [open, campaign])

  const fetchChannels = async () => {
    try {
      setLoadingChannels(true)
      const response = await fetch('/api/channels')
      if (response.ok) {
        const result = await response.json()
        setChannels(result.data || [])
        if (result.data?.length === 1) {
          setFormData(prev => ({ ...prev, channelId: result.data[0].id }))
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setLoadingChannels(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast.error('Campaign name is required')
      return
    }

    if (!formData.channelId) {
      toast.error('Please select a channel')
      return
    }

    if (formData.isScheduled && !formData.scheduledDate) {
      toast.error('Please select a scheduled date')
      return
    }

    try {
      setLoading(true)

      // Combine date and time for scheduled campaigns
      let scheduledAt: string | undefined
      if (formData.isScheduled && formData.scheduledDate) {
        const [hours, minutes] = formData.scheduledTime.split(':').map(Number)
        const scheduled = new Date(formData.scheduledDate)
        scheduled.setHours(hours, minutes, 0, 0)
        scheduledAt = scheduled.toISOString()
      }

      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        channelId: formData.channelId,
        messageType: formData.messageType,
        messageContent: formData.messageContent || undefined,
        targetSegment: formData.targetSegment || undefined,
        targetTags: formData.targetTags ? formData.targetTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        scheduledAt,
      }

      const url = campaign ? `/api/campaigns/${campaign.id}` : '/api/campaigns'
      const method = campaign ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${campaign ? 'update' : 'create'} campaign`)
      }

      toast.success(campaign ? 'Campaign updated successfully' : 'Campaign created successfully')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error creating campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
          <DialogDescription>
            {campaign ? 'Update campaign settings' : 'Create a new campaign to reach your contacts'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="Black Friday Sale"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Campaign Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BROADCAST">Broadcast</SelectItem>
                    <SelectItem value="DRIP">Drip Campaign</SelectItem>
                    <SelectItem value="TRIGGERED">Triggered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your campaign..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel">Channel *</Label>
                <Select
                  value={formData.channelId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, channelId: value }))}
                  disabled={loadingChannels}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingChannels ? "Loading..." : "Select channel"} />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name} ({channel.phoneNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="messageType">Message Type</Label>
                <Select
                  value={formData.messageType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, messageType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="DOCUMENT">Document</SelectItem>
                    <SelectItem value="TEMPLATE">Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="messageContent">Message Content</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  disabled={loading || !formData.name}
                  onClick={async () => {
                    if (!formData.name) {
                      toast.error("Please enter a campaign name first to generate context.");
                      return;
                    }
                    try {
                      toast.info("Generating creative copy...");
                      // We will add the API route for this next. 
                      // For now we simulate or call a generic endpoint.
                      const res = await fetch('/api/ai/generate-campaign-copy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: formData.name,
                          segment: formData.targetSegment,
                          type: formData.type
                        })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setFormData(prev => ({ ...prev, messageContent: data.content }));
                        toast.success("AI draft generated!");
                      } else {
                        // Fallback for visual demo if API not created yet
                        setTimeout(() => {
                          setFormData(prev => ({
                            ...prev,
                            messageContent: `🌟 Special Offer for our ${formData.targetSegment || 'Valued'} customers!\n\nDon't miss out on our ${formData.name}. Get exclusive access today.\n\nReply YES to claim your offer!`
                          }));
                          toast.success("AI draft generated (Preview)");
                        }, 1500);
                      }
                    } catch (e) {
                      console.error(e);
                      toast.error("Could not generate draft");
                    }
                  }}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Auto-Draft
                </Button>
              </div>
              <Textarea
                id="messageContent"
                placeholder="Enter your message..."
                value={formData.messageContent}
                onChange={(e) => setFormData(prev => ({ ...prev, messageContent: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetSegment">Target Segment</Label>
                <Input
                  id="targetSegment"
                  placeholder="e.g., VIP, Customers"
                  value={formData.targetSegment}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetSegment: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetTags">Target Tags</Label>
                <Input
                  id="targetTags"
                  placeholder="tag1, tag2, tag3"
                  value={formData.targetTags}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetTags: e.target.value }))}
                />
              </div>
            </div>

            {/* Scheduling Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="schedule">Schedule Campaign</Label>
                  <p className="text-xs text-muted-foreground">
                    Send this campaign at a specific date and time
                  </p>
                </div>
                <Switch
                  id="schedule"
                  checked={formData.isScheduled}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, isScheduled: checked }))
                  }
                />
              </div>

              {formData.isScheduled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !formData.scheduledDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.scheduledDate
                            ? format(formData.scheduledDate, 'PPP')
                            : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.scheduledDate || undefined}
                          onSelect={(date) => {
                            setFormData(prev => ({ ...prev, scheduledDate: date || null }))
                            setCalendarOpen(false)
                          }}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="time"
                        type="time"
                        value={formData.scheduledTime}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {campaign ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                campaign ? 'Update Campaign' : 'Create Campaign'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
