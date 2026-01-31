'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Bell, Mail, MessageSquare, Volume2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function NotificationSettings() {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    emailNewMessage: true,
    emailNewConversation: true,
    emailDailySummary: false,
    emailWeeklyReport: true,
    pushNewMessage: true,
    pushMentions: true,
    pushAssignments: true,
    soundEnabled: true,
    desktopNotifications: true,
  })

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: settings }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      toast.success('Notification settings saved')
    } catch (error) {
      console.error('Error saving notifications:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notifications</h2>
        <p className="text-muted-foreground">
          Manage how you receive notifications
        </p>
      </div>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Choose which email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New message received</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you receive a new message
              </p>
            </div>
            <Switch
              checked={settings.emailNewMessage}
              onCheckedChange={() => handleToggle('emailNewMessage')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New conversation started</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a new conversation is started
              </p>
            </div>
            <Switch
              checked={settings.emailNewConversation}
              onCheckedChange={() => handleToggle('emailNewConversation')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Daily summary</Label>
              <p className="text-sm text-muted-foreground">
                Receive a daily summary of your conversations
              </p>
            </div>
            <Switch
              checked={settings.emailDailySummary}
              onCheckedChange={() => handleToggle('emailDailySummary')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly report</Label>
              <p className="text-sm text-muted-foreground">
                Receive a weekly analytics report
              </p>
            </div>
            <Switch
              checked={settings.emailWeeklyReport}
              onCheckedChange={() => handleToggle('emailWeeklyReport')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Push Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure browser push notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New messages</Label>
              <p className="text-sm text-muted-foreground">
                Get push notifications for new messages
              </p>
            </div>
            <Switch
              checked={settings.pushNewMessage}
              onCheckedChange={() => handleToggle('pushNewMessage')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Mentions</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone mentions you
              </p>
            </div>
            <Switch
              checked={settings.pushMentions}
              onCheckedChange={() => handleToggle('pushMentions')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Assignments</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a conversation is assigned to you
              </p>
            </div>
            <Switch
              checked={settings.pushAssignments}
              onCheckedChange={() => handleToggle('pushAssignments')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sound & Desktop */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            <CardTitle>Sound & Desktop</CardTitle>
          </div>
          <CardDescription>
            Configure sound and desktop notification settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sound notifications</Label>
              <p className="text-sm text-muted-foreground">
                Play a sound when new messages arrive
              </p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={() => handleToggle('soundEnabled')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Desktop notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show desktop notifications when browser is minimized
              </p>
            </div>
            <Switch
              checked={settings.desktopNotifications}
              onCheckedChange={() => handleToggle('desktopNotifications')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )
}
