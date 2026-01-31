'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  MessageSquare,
  Webhook,
  Key,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  connected: boolean
  configurable: boolean
}

const integrations: Integration[] = [
  {
    id: 'evolution-api',
    name: 'Evolution API',
    description: 'Connect to WhatsApp using Evolution API',
    icon: MessageSquare,
    connected: false,
    configurable: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Enable AI-powered chatbots with GPT models',
    icon: Settings,
    connected: false,
    configurable: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Use Claude models for AI chatbots',
    icon: Settings,
    connected: false,
    configurable: true,
  },
  {
    id: 'webhook',
    name: 'Webhooks',
    description: 'Send events to external systems via webhooks',
    icon: Webhook,
    connected: true,
    configurable: true,
  },
]

export function IntegrationSettings() {
  const [configDialogOpen, setConfigDialogOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  const handleConnect = async (integrationId: string) => {
    setSaving(true)
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId,
          apiKey,
          apiUrl: apiUrl || undefined,
          enabled: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to connect integration')
      }

      const data = await response.json()
      toast.success(data.message || 'Integration connected successfully')
      setConfigDialogOpen(null)
      setApiKey('')
      setApiUrl('')
    } catch (error) {
      toast.error('Failed to connect integration')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations?id=${integrationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect integration')
      }

      const data = await response.json()
      toast.success(data.message || 'Integration disconnected')
    } catch (error) {
      toast.error('Failed to disconnect integration')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          Connect external services to extend functionality
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = integration.icon
          return (
            <Card key={integration.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={integration.connected ? 'default' : 'secondary'}>
                    {integration.connected ? (
                      <>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 h-3 w-3" />
                        Not Connected
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-end gap-2">
                  {integration.connected ? (
                    <>
                      {integration.configurable && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfigDialogOpen(integration.id)}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Dialog
                      open={configDialogOpen === integration.id}
                      onOpenChange={(open) =>
                        setConfigDialogOpen(open ? integration.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Key className="mr-2 h-4 w-4" />
                          Connect
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect {integration.name}</DialogTitle>
                          <DialogDescription>
                            Enter your API credentials to connect this integration
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          {integration.id === 'evolution-api' && (
                            <div className="space-y-2">
                              <Label htmlFor="api-url">API URL</Label>
                              <Input
                                id="api-url"
                                placeholder="https://api.evolution.example.com"
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="api-key">API Key</Label>
                            <Input
                              id="api-key"
                              type="password"
                              placeholder="Enter your API key"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setConfigDialogOpen(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleConnect(integration.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              'Connect'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Webhooks Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <CardTitle>Webhook Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure webhooks to receive events in your external systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input placeholder="https://your-server.com/webhook" />
              <Button variant="outline">Test</Button>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Events</Label>
            <div className="space-y-3">
              {[
                { id: 'message.received', label: 'Message received' },
                { id: 'message.sent', label: 'Message sent' },
                { id: 'conversation.created', label: 'Conversation created' },
                { id: 'conversation.resolved', label: 'Conversation resolved' },
                { id: 'contact.created', label: 'Contact created' },
                { id: 'contact.updated', label: 'Contact updated' },
              ].map((event) => (
                <div key={event.id} className="flex items-center justify-between">
                  <Label htmlFor={event.id} className="text-sm font-normal">
                    {event.label}
                  </Label>
                  <Switch id={event.id} defaultChecked />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button>Save Webhook Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
