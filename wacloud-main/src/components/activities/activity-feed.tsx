'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Phone,
  Mail,
  Calendar as CalendarIcon,
  CheckSquare,
  MessageSquare,
  FileText,
  Plus,
  Loader2,
  Check,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE' | 'WHATSAPP'
  title: string
  description: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

interface ActivityFeedProps {
  contactId?: string
  dealId?: string
  compact?: boolean
}

const activityIcons = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: CalendarIcon,
  TASK: CheckSquare,
  NOTE: FileText,
  WHATSAPP: MessageSquare,
}

const activityColors = {
  CALL: 'bg-blue-500',
  EMAIL: 'bg-purple-500',
  MEETING: 'bg-orange-500',
  TASK: 'bg-green-500',
  NOTE: 'bg-gray-500',
  WHATSAPP: 'bg-emerald-500',
}

export function ActivityFeed({ contactId, dealId, compact = false }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [formData, setFormData] = useState({
    type: 'NOTE' as Activity['type'],
    title: '',
    description: '',
    dueDate: null as Date | null,
  })

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (contactId) params.set('contactId', contactId)
      if (dealId) params.set('dealId', dealId)

      const response = await fetch(`/api/activities?${params}`)
      if (response.ok) {
        const result = await response.json()
        setActivities(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }, [contactId, dealId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title) {
      toast.error('Title is required')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          contactId,
          dealId,
          dueDate: formData.dueDate?.toISOString() || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create activity')
      }

      toast.success('Activity added')
      setDialogOpen(false)
      setFormData({
        type: 'NOTE',
        title: '',
        description: '',
        dueDate: null,
      })
      fetchActivities()
    } catch (error) {
      console.error('Error adding activity:', error)
      toast.error('Failed to add activity')
    } finally {
      setSaving(false)
    }
  }

  const toggleComplete = async (activity: Activity) => {
    try {
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
      })

      if (!response.ok) {
        throw new Error('Failed to update activity')
      }

      // Optimistic update
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id
            ? { ...a, completedAt: a.completedAt ? null : new Date().toISOString() }
            : a
        )
      )
    } catch (error) {
      console.error('Error toggling activity:', error)
      toast.error('Failed to update activity')
    }
  }

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Activities</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No activities yet
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type]
              const isCompleted = !!activity.completedAt

              return (
                <div key={activity.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
                      activityColors[activity.type],
                      isCompleted && 'opacity-50'
                    )}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </div>

                  <Card className={cn(isCompleted && 'opacity-60')}>
                    <CardContent className={cn('py-3', compact ? 'px-3' : 'px-4')}>
                      <div className="flex items-start gap-3">
                        {activity.type === 'TASK' && (
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={() => toggleComplete(activity)}
                            className="mt-1"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                'font-medium',
                                isCompleted && 'line-through'
                              )}
                            >
                              {activity.title}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {activity.type}
                            </Badge>
                            {isCompleted && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-green-100 text-green-700"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              {formatDistanceToNow(new Date(activity.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                            {activity.dueDate && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                Due {format(new Date(activity.dueDate), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Activity Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddActivity}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value as Activity['type'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTE">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Note
                      </div>
                    </SelectItem>
                    <SelectItem value="TASK">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Task
                      </div>
                    </SelectItem>
                    <SelectItem value="CALL">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Call
                      </div>
                    </SelectItem>
                    <SelectItem value="EMAIL">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="MEETING">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Meeting
                      </div>
                    </SelectItem>
                    <SelectItem value="WHATSAPP">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Follow up call"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Details about this activity..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>

              {(formData.type === 'TASK' || formData.type === 'MEETING') && (
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dueDate
                          ? format(formData.dueDate, 'PPP')
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.dueDate || undefined}
                        onSelect={(date) => {
                          setFormData((prev) => ({
                            ...prev,
                            dueDate: date || null,
                          }))
                          setCalendarOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Activity'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
