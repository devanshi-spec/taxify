'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileSettingsProps {
  user: {
    name: string | null
    email: string
    avatarUrl: string | null
  }
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const [name, setName] = useState(user.name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    setHasChanges(value !== (user.name || ''))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      toast.success('Profile updated successfully')
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Profile</h2>
        <p className="text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      <Separator />

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Picture</CardTitle>
          <CardDescription>
            This is your avatar. Click to upload a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {name?.[0] || user.email?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="outline"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Recommended: Square image, at least 200x200px</p>
              <p>Formats: JPG, PNG, GIF (max 5MB)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
          <CardDescription>
            Update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if needed.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>
            Change your password or enable two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
            />
          </div>

          <Button variant="outline">Change Password</Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
