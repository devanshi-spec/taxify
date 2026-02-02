
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  QrCode,
  Loader2,
  Instagram,
  MessageCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface Channel {
  id: string
  name: string
  phoneNumber: string | null
  instagramId: string | null
  connectionType: string
  status: string
  platform: 'WHATSAPP' | 'INSTAGRAM'
  createdAt: string
}

const statusConfig = {
  CONNECTED: { label: 'Connected', color: 'bg-green-500', icon: CheckCircle },
  DISCONNECTED: { label: 'Disconnected', color: 'bg-red-500', icon: XCircle },
  PENDING: { label: 'Pending', color: 'bg-yellow-500', icon: Loader2 },
  ERROR: { label: 'Error', color: 'bg-red-500', icon: XCircle },
}

export function ChannelsSettings() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [connectionType, setConnectionType] = useState<string>('CLOUD_API')
  const [platform, setPlatform] = useState<string>('WHATSAPP')
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [reconnecting, setReconnecting] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phoneNumberId: '',
    instagramId: '',
    accessToken: '',
    instanceName: '',
  })

  useEffect(() => {
    fetchChannels()
  }, [])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/channels')
      if (response.ok) {
        const result = await response.json()
        setChannels(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
      toast.error('Failed to load channels')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateChannel = async () => {
    if (!formData.name) {
      toast.error('Channel name is required')
      return
    }

    try {
      setSubmitting(true)

      const payload: Record<string, unknown> = {
        name: formData.name,
        connectionType,
        platform,
        status: 'PENDING',
      }

      if (platform === 'WHATSAPP') {
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
      } else if (platform === 'INSTAGRAM') {
        if (!formData.instagramId || !formData.accessToken) {
          toast.error('Instagram Account ID and Access Token are required')
          return
        }
        payload.instagramId = formData.instagramId
        payload.accessToken = formData.accessToken
        payload.connectionType = 'CLOUD_API' // Force Cloud API for now
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
      setIsAddDialogOpen(false)
      setFormData({ name: '', phoneNumberId: '', instagramId: '', accessToken: '', instanceName: '' })
      setConnectionType('CLOUD_API')
      setPlatform('WHATSAPP')
      fetchChannels()
    } catch (error) {
      console.error('Error creating channel:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create channel')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteChannel = async () => {
    if (!deleteChannelId) return

    try {
      const response = await fetch(`/api/channels/${deleteChannelId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete channel')
      }

      toast.success('Channel deleted successfully')
      fetchChannels()
    } catch (error) {
      console.error('Error deleting channel:', error)
      toast.error('Failed to delete channel')
    } finally {
      setDeleteChannelId(null)
    }
  }

  // Handle editing channel
  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel)
    setFormData({
      name: channel.name,
      phoneNumberId: '',
      instagramId: '',
      accessToken: '',
      instanceName: '',
    })
    setConnectionType(channel.connectionType)
    setPlatform(channel.platform)
    setIsAddDialogOpen(true)
  }

  // Handle updating channel
  const handleUpdateChannel = async () => {
    if (!editingChannel || !formData.name) {
      toast.error('Channel name is required')
      return
    }

    try {
      setSubmitting(true)

      const payload: Record<string, unknown> = {
        name: formData.name,
      }

      // Only include credentials if they were provided (for updating)
      if (platform === 'WHATSAPP' && connectionType === 'CLOUD_API') {
        if (formData.phoneNumberId) payload.phoneNumberId = formData.phoneNumberId
        if (formData.accessToken) payload.accessToken = formData.accessToken
      } else if (platform === 'INSTAGRAM') {
        if (formData.instagramId) payload.instagramId = formData.instagramId
        if (formData.accessToken) payload.accessToken = formData.accessToken
      } else if (connectionType === 'EVOLUTION_API') {
        if (formData.instanceName) payload.instanceName = formData.instanceName
      }

      const response = await fetch(`/api/channels/${editingChannel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update channel')
      }

      toast.success('Channel updated successfully')
      setIsAddDialogOpen(false)
      setEditingChannel(null)
      setFormData({ name: '', phoneNumberId: '', instagramId: '', accessToken: '', instanceName: '' })
      fetchChannels()
    } catch (error) {
      console.error('Error updating channel:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update channel')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle reconnecting channel
  const handleReconnect = async (channelId: string) => {
    setReconnecting(channelId)
    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING' }),
      })

      if (response.ok) {
        toast.success('Reconnection initiated')
        fetchChannels()
      } else {
        toast.error('Failed to reconnect')
      }
    } catch (error) {
      toast.error('Failed to reconnect')
    } finally {
      setReconnecting(null)
    }
  }

  // Reset dialog state when closing
  const handleDialogClose = (open: boolean) => {
    setIsAddDialogOpen(open)
    if (!open) {
      setEditingChannel(null)
      setFormData({ name: '', phoneNumberId: '', instagramId: '', accessToken: '', instanceName: '' })
      setConnectionType('CLOUD_API')
      setPlatform('WHATSAPP')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Channels</h2>
          <p className="text-muted-foreground">
            Connect and manage your messaging channels (WhatsApp, Instagram)
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingChannel ? 'Edit Channel' : 'Connect New Channel'}
              </DialogTitle>
              <DialogDescription>
                {editingChannel
                  ? 'Update channel settings'
                  : 'Add a new messaging channel to your account'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform} disabled={!!editingChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <span>WhatsApp</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="INSTAGRAM">
                      <div className="flex items-center gap-2">
                        <Instagram className="h-4 w-4" />
                        <span>Instagram</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {platform === 'WHATSAPP' && (
                <div className="space-y-2">
                  <Label>Connection Type</Label>
                  <Select value={connectionType} onValueChange={setConnectionType} disabled={!!editingChannel}>
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
              )}

              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name *</Label>
                <Input
                  id="channel-name"
                  placeholder="e.g., Main Business Line"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {platform === 'WHATSAPP' && connectionType === 'CLOUD_API' && (
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
              )}

              {platform === 'WHATSAPP' && connectionType === 'EVOLUTION_API' && (
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

              {platform === 'INSTAGRAM' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="instagram-id">Instagram Account ID *</Label>
                    <Input
                      id="instagram-id"
                      placeholder="Enter Instagram Business Account ID"
                      value={formData.instagramId}
                      onChange={(e) => setFormData(prev => ({ ...prev, instagramId: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Found in Meta Developer Portal (App Dashboard)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="access-token">Access Token *</Label>
                    <Input
                      id="access-token"
                      type="password"
                      placeholder="Enter Meta User Access Token"
                      value={formData.accessToken}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleDialogClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={editingChannel ? handleUpdateChannel : handleCreateChannel}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingChannel ? 'Updating...' : 'Creating...'}
                  </>
                ) : editingChannel ? (
                  'Update'
                ) : (
                  'Connect'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Connected channels */}
      <div className="space-y-4">
        {channels.map((channel) => {
          const status = statusConfig[channel.status as keyof typeof statusConfig] || statusConfig.PENDING
          const isInstagram = channel.platform === 'INSTAGRAM'

          return (
            <Card key={channel.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isInstagram ? 'bg-pink-100' : 'bg-primary/10'}`}>
                    {isInstagram ? (
                      <Instagram className="h-6 w-6 text-pink-600" />
                    ) : (
                      <Phone className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{channel.name}</h3>
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <span className={`h-2 w-2 rounded-full ${status.color}`} />
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isInstagram
                        ? (channel.instagramId || 'IG ID Pending')
                        : (channel.phoneNumber || 'Phone number pending')
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isInstagram ? 'Instagram DM' : (channel.connectionType === 'CLOUD_API' ? 'WhatsApp Cloud API' : 'Evolution API')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(channel.status === 'DISCONNECTED' || channel.status === 'ERROR') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReconnect(channel.id)}
                      disabled={reconnecting === channel.id}
                    >
                      {reconnecting === channel.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reconnect
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditChannel(channel)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleteChannelId(channel.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {channels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No channels connected</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect your WhatsApp or Instagram account to start messaging
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Help section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need Help?</CardTitle>
          <CardDescription>
            Learn how to connect your messaging channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="link" className="h-auto p-0">
            How to set up WhatsApp Cloud API
          </Button>
          <br />
          <Button variant="link" className="h-auto p-0">
            How to connect Instagram Account
          </Button>
          <br />
          <Button variant="link" className="h-auto p-0">
            Troubleshooting connection issues
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteChannelId} onOpenChange={() => setDeleteChannelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this channel? This action cannot be undone.
              All conversations and messages associated with this channel will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
