'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Loader2, QrCode } from 'lucide-react'
import { toast } from 'sonner'

interface ChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ChannelDialog({ open, onOpenChange, onSuccess }: ChannelDialogProps) {
  const [loading, setLoading] = useState(false)
  const [connectionType, setConnectionType] = useState<string>('CLOUD_API')
  const [formData, setFormData] = useState({
    name: '',
    phoneNumberId: '',
    accessToken: '',
    instanceName: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast.error('Channel name is required')
      return
    }

    try {
      setLoading(true)

      const payload: Record<string, unknown> = {
        name: formData.name,
        connectionType,
        status: 'PENDING',
      }

      if (connectionType === 'CLOUD_API') {
        if (!formData.phoneNumberId || !formData.accessToken) {
          toast.error('Phone Number ID and Access Token are required')
          return
        }
        payload.phoneNumberId = formData.phoneNumberId
        payload.accessToken = formData.accessToken
      } else {
        if (!formData.instanceName) {
          toast.error('Instance name is required')
          return
        }
        payload.instanceName = formData.instanceName
      }

      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create channel')
      }

      toast.success('Channel created successfully')
      onOpenChange(false)
      setFormData({ name: '', phoneNumberId: '', accessToken: '', instanceName: '' })
      setConnectionType('CLOUD_API')
      onSuccess?.()
    } catch (error) {
      console.error('Error creating channel:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create channel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp Channel</DialogTitle>
          <DialogDescription>
            Add a new WhatsApp number to your account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <Select value={connectionType} onValueChange={setConnectionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOUD_API">
                    WhatsApp Cloud API (Meta)
                  </SelectItem>
                  <SelectItem value="EVOLUTION_API">
                    Evolution API (Self-hosted)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-name">Channel Name *</Label>
              <Input
                id="channel-name"
                placeholder="e.g., Main Business Line"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {connectionType === 'CLOUD_API' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone-number-id">Phone Number ID *</Label>
                  <Input
                    id="phone-number-id"
                    placeholder="Enter Meta Phone Number ID"
                    value={formData.phoneNumberId}
                    onChange={(e) => setFormData(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="access-token">Access Token *</Label>
                  <Input
                    id="access-token"
                    type="password"
                    placeholder="Enter Meta Access Token"
                    value={formData.accessToken}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="instance-name">Instance Name *</Label>
                  <Input
                    id="instance-name"
                    placeholder="Enter Evolution instance name"
                    value={formData.instanceName}
                    onChange={(e) => setFormData(prev => ({ ...prev, instanceName: e.target.value }))}
                  />
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    QR code will appear here after creating the instance
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : connectionType === 'CLOUD_API' ? (
                'Connect'
              ) : (
                'Create Instance'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
