'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Channel {
  id: string
  name: string
  phoneNumber: string
}

interface Contact {
  id: string
  name: string | null
  phoneNumber: string
  email: string | null
  stage: string
  segment?: string | null
  notes?: string | null
  tags: string[]
  channel?: Channel
}

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact | null
  onSuccess?: () => void
}

export function ContactDialog({ open, onOpenChange, contact, onSuccess }: ContactDialogProps) {
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    channelId: '',
    stage: 'NEW',
    segment: '',
    notes: '',
    tags: '',
  })

  useEffect(() => {
    if (open) {
      fetchChannels()
      if (contact) {
        setFormData({
          name: contact.name || '',
          phoneNumber: contact.phoneNumber,
          email: contact.email || '',
          channelId: contact.channel?.id || '',
          stage: contact.stage,
          segment: contact.segment || '',
          notes: contact.notes || '',
          tags: contact.tags.join(', '),
        })
      } else {
        setFormData({
          name: '',
          phoneNumber: '',
          email: '',
          channelId: '',
          stage: 'NEW',
          segment: '',
          notes: '',
          tags: '',
        })
      }
    }
  }, [open, contact])

  const fetchChannels = async () => {
    try {
      setLoadingChannels(true)
      const response = await fetch('/api/channels')
      if (response.ok) {
        const result = await response.json()
        setChannels(result.data || [])
        // Set default channel if only one exists
        if (result.data?.length === 1 && !contact) {
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

    if (!formData.phoneNumber) {
      toast.error('Phone number is required')
      return
    }

    if (!formData.channelId && !contact) {
      toast.error('Please select a channel')
      return
    }

    try {
      setLoading(true)

      const payload = {
        name: formData.name || undefined,
        phoneNumber: formData.phoneNumber,
        email: formData.email || undefined,
        channelId: formData.channelId,
        stage: formData.stage,
        segment: formData.segment || undefined,
        notes: formData.notes || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      }

      const url = contact ? `/api/contacts/${contact.id}` : '/api/contacts'
      const method = contact ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save contact')
      }

      toast.success(contact ? 'Contact updated' : 'Contact created')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving contact:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          <DialogDescription>
            {contact ? 'Update contact information' : 'Add a new contact to your list'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+1234567890"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  required
                  disabled={!!contact}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel *</Label>
                <Select
                  value={formData.channelId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, channelId: value }))}
                  disabled={!!contact || loadingChannels}
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="QUALIFIED">Qualified</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="CHURNED">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment">Segment</Label>
                <Input
                  id="segment"
                  placeholder="e.g., VIP, Enterprise"
                  value={formData.segment}
                  onChange={(e) => setFormData(prev => ({ ...prev, segment: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="Enter tags separated by commas"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple tags with commas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this contact..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
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
                  Saving...
                </>
              ) : (
                contact ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
