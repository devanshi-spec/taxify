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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface QuickReply {
  id: string
  title: string
  shortcut: string
  content: string
  category: string | null
  tags: string[]
  isGlobal: boolean
}

interface QuickReplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quickReply?: QuickReply | null
  onSuccess?: () => void
}

export function QuickReplyDialog({
  open,
  onOpenChange,
  quickReply,
  onSuccess,
}: QuickReplyDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    shortcut: '/',
    content: '',
    category: '',
    tags: '',
    isGlobal: false,
  })

  useEffect(() => {
    if (open) {
      if (quickReply) {
        setFormData({
          title: quickReply.title,
          shortcut: quickReply.shortcut,
          content: quickReply.content,
          category: quickReply.category || '',
          tags: quickReply.tags.join(', '),
          isGlobal: quickReply.isGlobal,
        })
      } else {
        setFormData({
          title: '',
          shortcut: '/',
          content: '',
          category: '',
          tags: '',
          isGlobal: false,
        })
      }
    }
  }, [open, quickReply])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.shortcut || !formData.content) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!formData.shortcut.startsWith('/')) {
      toast.error('Shortcut must start with /')
      return
    }

    try {
      setLoading(true)

      const payload = {
        title: formData.title,
        shortcut: formData.shortcut.toLowerCase(),
        content: formData.content,
        category: formData.category || undefined,
        tags: formData.tags
          ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        isGlobal: formData.isGlobal,
      }

      const url = quickReply
        ? `/api/quick-replies/${quickReply.id}`
        : '/api/quick-replies'
      const method = quickReply ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save quick reply')
      }

      toast.success(
        quickReply
          ? 'Quick reply updated successfully'
          : 'Quick reply created successfully'
      )
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving quick reply:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to save quick reply'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {quickReply ? 'Edit Quick Reply' : 'Create Quick Reply'}
          </DialogTitle>
          <DialogDescription>
            {quickReply
              ? 'Update your quick reply template'
              : 'Create a new quick reply for fast responses. Use "/" in the chat to access it.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Thank you response"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortcut">Shortcut *</Label>
                <Input
                  id="shortcut"
                  placeholder="/thanks"
                  value={formData.shortcut}
                  onChange={(e) => {
                    let value = e.target.value
                    if (!value.startsWith('/')) {
                      value = '/' + value
                    }
                    setFormData((prev) => ({
                      ...prev,
                      shortcut: value.toLowerCase().replace(/[^a-z0-9/_-]/g, ''),
                    }))
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Type this in chat to use the reply
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Message Content *</Label>
              <Textarea
                id="content"
                placeholder="Thank you for contacting us! We appreciate your patience..."
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, content: e.target.value }))
                }
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{name}}'}, {'{{first_name}}'}, {'{{phone}}'}, {'{{email}}'} for personalization
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="Support"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, category: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="greeting, welcome"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tags: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isGlobal">Share with team</Label>
                <p className="text-xs text-muted-foreground">
                  Make this quick reply available to all team members
                </p>
              </div>
              <Switch
                id="isGlobal"
                checked={formData.isGlobal}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isGlobal: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {quickReply ? 'Updating...' : 'Creating...'}
                </>
              ) : quickReply ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
