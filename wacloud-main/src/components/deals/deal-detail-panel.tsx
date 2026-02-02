'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DealProducts } from '@/components/deals/deal-products'
import {
  Loader2,
  Phone,
  Mail,
  Calendar,
  User,
  DollarSign,
  Target,
  Clock,
  Plus,
  Edit2,
  CheckCircle,
  Circle,
  MessageSquare,
  PhoneCall,
  Video,
  FileText,
  CheckSquare,
  Send,
  Sparkles,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Contact {
  id: string
  name: string | null
  phoneNumber: string
  email: string | null
  avatarUrl: string | null
  stage: string
  segment: string | null
  tags: string[]
}

interface Activity {
  id: string
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE' | 'WHATSAPP'
  title: string
  description: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  createdBy: string
}

interface Stage {
  id: string
  name: string
  color: string
  probability: number
}

interface Pipeline {
  id: string
  name: string
  stages: Stage[]
}

interface TeamMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: string
}

interface Deal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  closedAt: string | null
  assignedTo: string | null
  contact: Contact
  pipeline: Pipeline
  activities: Activity[]
  assignedUser?: TeamMember | null
  createdAt: string
}

interface DealDetailPanelProps {
  dealId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

const activityIcons = {
  CALL: PhoneCall,
  EMAIL: Mail,
  MEETING: Video,
  TASK: CheckSquare,
  NOTE: FileText,
  WHATSAPP: Send,
}

const activityColors = {
  CALL: 'text-blue-500 bg-blue-500/10',
  EMAIL: 'text-purple-500 bg-purple-500/10',
  MEETING: 'text-green-500 bg-green-500/10',
  TASK: 'text-orange-500 bg-orange-500/10',
  NOTE: 'text-gray-500 bg-gray-500/10',
  WHATSAPP: 'text-emerald-500 bg-emerald-500/10',
}

export function DealDetailPanel({
  dealId,
  open,
  onOpenChange,
  onUpdate,
}: DealDetailPanelProps) {
  const [loading, setLoading] = useState(false)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [activityLoading, setActivityLoading] = useState(false)
  const [newActivity, setNewActivity] = useState({
    type: 'NOTE' as Activity['type'],
    title: '',
    description: '',
    dueDate: '',
  })
  const [showActivityForm, setShowActivityForm] = useState(false)

  useEffect(() => {
    if (open && dealId) {
      fetchDeal()
    }
  }, [open, dealId])

  const fetchDeal = async () => {
    if (!dealId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/deals/${dealId}`)
      if (response.ok) {
        const result = await response.json()
        setDeal(result.data)
      }
    } catch (error) {
      console.error('Error fetching deal:', error)
      toast.error('Failed to load deal details')
    } finally {
      setLoading(false)
    }
  }

  const handleAddActivity = async () => {
    if (!deal || !newActivity.title) {
      toast.error('Activity title is required')
      return
    }

    try {
      setActivityLoading(true)
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newActivity,
          dealId: deal.id,
          contactId: deal.contact.id,
          dueDate: newActivity.dueDate || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to create activity')

      toast.success('Activity added')
      setNewActivity({ type: 'NOTE', title: '', description: '', dueDate: '' })
      setShowActivityForm(false)
      fetchDeal()
    } catch (error) {
      console.error('Error creating activity:', error)
      toast.error('Failed to add activity')
    } finally {
      setActivityLoading(false)
    }
  }

  const handleToggleActivity = async (activity: Activity) => {
    try {
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
      })

      if (!response.ok) throw new Error('Failed to update activity')

      fetchDeal()
    } catch (error) {
      console.error('Error toggling activity:', error)
      toast.error('Failed to update activity')
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getCurrentStage = () => {
    if (!deal) return null
    return deal.pipeline.stages.find((s) => s.id === deal.stage)
  }

  const currentStage = getCurrentStage()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] p-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <SheetHeader className="sr-only">
              <SheetTitle>Loading Deal Details</SheetTitle>
            </SheetHeader>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deal ? (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <SheetTitle className="text-xl">{deal.title}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      {formatCurrency(deal.value, deal.currency)}
                    </span>
                    {currentStage && (
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: `${currentStage.color}20`, color: currentStage.color }}
                      >
                        {currentStage.name}
                      </Badge>
                    )}
                  </SheetDescription>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {deal.probability}%
                </Badge>
              </div>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="px-6 justify-start rounded-none border-b bg-transparent h-auto p-0">
                <TabsTrigger
                  value="overview"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="activities"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Activities ({deal.activities.length})
                </TabsTrigger>
                <TabsTrigger
                  value="products"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Products
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="overview" className="m-0 p-6 space-y-6">
                  {/* AI Insights */}
                  <div className="rounded-lg bg-violet-50 p-4 border border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
                        <Sparkles className="h-4 w-4" />
                        <span className="font-semibold">AI Insights</span>
                      </div>
                      <Badge variant="outline" className="bg-white/50 dark:bg-black/20 text-violet-700 border-violet-200">
                        {deal.probability > 70 ? 'High Potential' : deal.probability > 40 ? 'Medium Potential' : 'Needs Attention'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        Win probability is projected at <span className="font-medium text-foreground">{deal.probability}%</span> based on current stage and activity velocity.
                      </p>
                      <div className="flex gap-2 items-start">
                        <Target className="h-4 w-4 mt-0.5 text-violet-500" />
                        <span>Recommended action: Schedule a follow-up call to discuss pricing options within the next 48 hours.</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={deal.contact.avatarUrl || undefined} />
                          <AvatarFallback>{getInitials(deal.contact.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{deal.contact.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{deal.contact.phoneNumber}</p>
                        </div>
                      </div>
                      {deal.contact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{deal.contact.email}</span>
                        </div>
                      )}
                      {deal.contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {deal.contact.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Deal Details */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Deal Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Pipeline</p>
                          <p className="text-sm font-medium">{deal.pipeline.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Stage</p>
                          <div className="flex items-center gap-2">
                            {currentStage && (
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: currentStage.color }}
                              />
                            )}
                            <p className="text-sm font-medium">{currentStage?.name || deal.stage}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Expected Close</p>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {deal.expectedCloseDate
                              ? format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')
                              : 'Not set'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Assigned To</p>
                          {deal.assignedUser ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={deal.assignedUser.avatarUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(deal.assignedUser.name)}
                                </AvatarFallback>
                              </Avatar>
                              <p className="text-sm">{deal.assignedUser.name || deal.assignedUser.email}</p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Unassigned</p>
                          )}
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Created {formatDistanceToNow(new Date(deal.createdAt), { addSuffix: true })}</span>
                        {deal.closedAt && (
                          <span>Closed {format(new Date(deal.closedAt), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pipeline Progress */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Pipeline Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-1">
                        {deal.pipeline.stages.map((stage, index) => {
                          const isActive = stage.id === deal.stage
                          const isPast = deal.pipeline.stages.findIndex((s) => s.id === deal.stage) > index
                          return (
                            <div
                              key={stage.id}
                              className={cn(
                                'flex-1 h-2 rounded-full transition-colors',
                                isActive
                                  ? 'bg-primary'
                                  : isPast
                                    ? 'bg-primary/50'
                                    : 'bg-muted'
                              )}
                              title={stage.name}
                            />
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        {deal.pipeline.stages.map((stage) => (
                          <span
                            key={stage.id}
                            className={cn(
                              'truncate',
                              stage.id === deal.stage && 'text-primary font-medium'
                            )}
                          >
                            {stage.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activities" className="m-0 p-6 space-y-4">
                  {/* Add Activity Button */}
                  {!showActivityForm ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowActivityForm(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Activity
                    </Button>
                  ) : (
                    <Card>
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={newActivity.type}
                              onValueChange={(value) =>
                                setNewActivity((prev) => ({ ...prev, type: value as Activity['type'] }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NOTE">Note</SelectItem>
                                <SelectItem value="CALL">Call</SelectItem>
                                <SelectItem value="EMAIL">Email</SelectItem>
                                <SelectItem value="MEETING">Meeting</SelectItem>
                                <SelectItem value="TASK">Task</SelectItem>
                                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Due Date (optional)</Label>
                            <Input
                              type="date"
                              value={newActivity.dueDate}
                              onChange={(e) =>
                                setNewActivity((prev) => ({ ...prev, dueDate: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            placeholder="Activity title..."
                            value={newActivity.title}
                            onChange={(e) =>
                              setNewActivity((prev) => ({ ...prev, title: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description (optional)</Label>
                          <Textarea
                            placeholder="Add details..."
                            value={newActivity.description}
                            onChange={(e) =>
                              setNewActivity((prev) => ({ ...prev, description: e.target.value }))
                            }
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => setShowActivityForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleAddActivity} disabled={activityLoading}>
                            {activityLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add Activity
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Activities List */}
                  <div className="space-y-3">
                    {deal.activities.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No activities yet</p>
                        <p className="text-sm">Add notes, calls, or tasks to track this deal</p>
                      </div>
                    ) : (
                      deal.activities.map((activity) => {
                        const Icon = activityIcons[activity.type] || FileText
                        const colorClass = activityColors[activity.type] || activityColors.NOTE
                        const isTask = activity.type === 'TASK'
                        const isCompleted = !!activity.completedAt

                        return (
                          <div
                            key={activity.id}
                            className={cn(
                              'flex gap-3 p-3 rounded-lg border',
                              isCompleted && 'opacity-60'
                            )}
                          >
                            <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isTask && (
                                    <Checkbox
                                      checked={isCompleted}
                                      onCheckedChange={() => handleToggleActivity(activity)}
                                    />
                                  )}
                                  <p className={cn('font-medium', isCompleted && 'line-through')}>
                                    {activity.title}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  {activity.type}
                                </Badge>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground">{activity.description}</p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                                {activity.dueDate && !isCompleted && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Due {format(new Date(activity.dueDate), 'MMM d')}
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-3 w-3" />
                                    Completed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="products" className="m-0 p-6 h-full">
                  <DealProducts dealId={deal.id} currency={deal.currency} />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Deal not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
