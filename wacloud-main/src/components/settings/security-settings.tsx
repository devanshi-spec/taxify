'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  Key,
  Smartphone,
  Globe,
  Clock,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

export function SecuritySettings() {
  const [loading, setLoading] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(true)

  const handlePasswordChange = async () => {
    setLoading(true)
    try {
      // Simulate password change request
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Password reset email sent')
    } catch {
      toast.error('Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Security</h2>
        <p className="text-muted-foreground">
          Manage your account security settings
        </p>
      </div>

      <Separator />

      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Password</CardTitle>
          </div>
          <CardDescription>
            Update your password or reset it via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" placeholder="Enter current password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="Enter new password" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
            <Button variant="outline" onClick={handlePasswordChange} disabled={loading}>
              Reset via Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Enable 2FA</p>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app for additional security
              </p>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={(checked) => {
                setTwoFactorEnabled(checked)
                toast.success(checked ? '2FA enabled' : '2FA disabled')
              }}
            />
          </div>
          {twoFactorEnabled && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Scan the QR code below with your authenticator app to complete setup.
                This is a demo - in production, this would show an actual QR code.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Session Settings</CardTitle>
          </div>
          <CardDescription>
            Control your session and login preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Auto-logout after inactivity</p>
              <p className="text-sm text-muted-foreground">
                Automatically log out after 30 minutes of inactivity
              </p>
            </div>
            <Switch
              checked={sessionTimeout}
              onCheckedChange={(checked) => {
                setSessionTimeout(checked)
                toast.success(checked ? 'Session timeout enabled' : 'Session timeout disabled')
              }}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="font-medium">Active Sessions</p>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Current Session</p>
                    <p className="text-xs text-muted-foreground">
                      Last active: Just now
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            </div>
          </div>
          <Button variant="destructive" size="sm">
            Sign Out All Other Sessions
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
