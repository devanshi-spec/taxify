'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  MoreVertical,
  Edit,
  Trash2,
  DollarSign,
  Activity,
  Calendar,
  Clock,
  Tag,
  User,
  Building,
  CheckCircle,
  XCircle,
  MessageCircle,
  FileText,
  PhoneCall,
  Video,
  Target,
  Plus,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DealDialog } from '@/components/deals/deal-dialog'

interface Pipeline {
  id: string
  name: string
  stages: Array<{ id: string; name: string; color: string; probability: number; order: number }>
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
  pipeline: Pipeline
  assignedUser: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
  _count: { activities: number }
  createdAt: string
}

interface Conversation {
  id: string
  status: string
  lastMessageAt: string | null
  messages: Array<{
    id: string
    content: string
    direction: string
    createdAt: string
  }>
  _count: { messages: number }
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string | null
  dueDate: string | null
  completedAt: string | null
  deal: { id: string; title: string } | null
  creator: { id: string; name: string | null; avatarUrl: string | null }
  createdAt: string
}

interface Contact {
  id: string
  phoneNumber: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  waId: string | null
  profileName: string | null
  tags: string[]
  notes: string | null
  segment: string | null
  leadScore: number
  stage: string
  isOptedIn: boolean
  assignedTo: string | null
  channel: { id: string; name: string; phoneNumber: string }
  conversations: Conversation[]
  deals: Deal[]
  activities: ActivityItem[]
  lastContactedAt: string | null
  createdAt: string
  _count: {
    conversations: number
    campaignContacts: number
    deals: number
    activities: number
  }
}

interface ContactDetailContentProps {
  contactId: string
}

const stageColors: Record<string, string> = {
  NEW: 'bg-blue-500',
  LEAD: 'bg-purple-500',
  QUALIFIED: 'bg-amber-500',
  CUSTOMER: 'bg-green-500',
  CHURNED: 'bg-red-500',
}

const activityIcons: Record<string, React.ElementType> = {
  CALL: PhoneCall,
  EMAIL: Mail,
  MEETING: Video,
  TASK: CheckCircle,
  NOTE: FileText,
  WHATSAPP: MessageCircle,
}

export function ContactDetailContent({ contactId }: ContactDetailContentProps) {
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [dealDialogOpen, setDealDialogOpen] = useState(false)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])

  const fetchContact = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/contacts/${contactId}`)
      if (response.ok) {
        const result = await response.json()
        setContact(result.data)
      } else {
        toast.error('Contact not found')
        router.push('/contacts')
      }
    } catch (error) {
      console.error('Error fetching contact:', error)
      toast.error('Failed to load contact')
    } finally {
      setLoading(false)
    }
  }, [contactId, router])

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const result = await response.json()
        setPipelines(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  useEffect(() => {
    fetchContact()
    fetchPipelines()
  }, [fetchContact])

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
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

  const getStageInfo = (deal: Deal) => {
    const stages = deal.pipeline.stages as Array<{ id: string; name: string; color: string }>
    return stages.find((s) => s.id === deal.stage)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const response = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Contact deleted')
        router.push('/contacts')
      } else {
        throw new Error('Failed to delete')
      }
    } catch (error) {
      toast.error('Failed to delete contact')
    }
  }

  const openConversation = (conversationId: string) => {
    router.push(`/inbox?conversation=${conversationId}`)
  }

  const [enriching, setEnriching] = useState(false)

  const handleEnrich = async () => {
    try {
      setEnriching(true)
      const response = await fetch('/api/contacts/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      })

      if (!response.ok) throw new Error('Failed to enrich contact')

      const result = await response.json()

      const { extractedData } = result.data
      const newFields = Object.entries(extractedData || {})
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')

      toast.success(
        newFields
          ? `Enriched profile with: ${newFields}`
          : 'Analysis complete. No new information found.'
      )

      fetchContact()
    } catch (error) {
      console.error('Error enriching contact:', error)
      toast.error('Failed to enrich contact')
    } finally {
      setEnriching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Contact not found
      </div>
    )
  }

  const totalDealsValue = contact.deals.reduce((sum, deal) => sum + deal.value, 0)
  const openDeals = contact.deals.filter((d) => !d.closedAt)
  const wonDeals = contact.deals.filter((d) => d.closedAt && d.stage === 'closed')

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-16 w-16">
              <AvatarImage src={contact.avatarUrl || undefined} />
              <AvatarFallback className="text-xl">
                {getInitials(contact.name || contact.profileName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  {contact.name || contact.profileName || contact.phoneNumber}
                </h1>
                <Badge className={cn('text-white', stageColors[contact.stage])}>
                  {contact.stage}
                </Badge>
                {!contact.isOptedIn && (
                  <Badge variant="destructive">Opted Out</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {contact.phoneNumber}
                </span>
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {contact.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  {contact.channel.name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleEnrich} disabled={enriching}>
              {enriching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2 text-indigo-500" />
              )}
              Enrich Profile
            </Button>
            <Button variant="outline" onClick={() => openConversation(contact.conversations[0]?.id)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Message
            </Button>
            <Button onClick={() => setDealDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contact
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-xl font-bold">{formatCurrency(totalDealsValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Deals</p>
                  <p className="text-xl font-bold">{openDeals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Won Deals</p>
                  <p className="text-xl font-bold">{wonDeals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                  <p className="text-xl font-bold">{contact._count.conversations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Details & Activity */}
          <div className="col-span-2 space-y-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deals">Deals ({contact._count.deals})</TabsTrigger>
                <TabsTrigger value="conversations">Conversations ({contact._count.conversations})</TabsTrigger>
                <TabsTrigger value="activities">Activities ({contact._count.activities})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{contact.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{contact.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">WhatsApp Profile</p>
                        <p className="font-medium">{contact.profileName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Segment</p>
                        <p className="font-medium">{contact.segment || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Lead Score</p>
                        <p className="font-medium">{contact.leadScore}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    {contact.tags.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Deals */}
                {contact.deals.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Recent Deals</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/deals?contactId=${contactId}`)}>
                        View All
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {contact.deals.slice(0, 3).map((deal) => {
                        const stage = getStageInfo(deal)
                        return (
                          <div
                            key={deal.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/deals?deal=${deal.id}`)}
                          >
                            <div>
                              <p className="font-medium">{deal.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {stage && (
                                  <Badge
                                    variant="secondary"
                                    style={{
                                      backgroundColor: `${stage.color}20`,
                                      color: stage.color,
                                    }}
                                  >
                                    {stage.name}
                                  </Badge>
                                )}
                                <span className="text-sm text-muted-foreground">
                                  {deal.pipeline.name}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(deal.value, deal.currency)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(deal.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="deals" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">All Deals</CardTitle>
                    <Button size="sm" onClick={() => setDealDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Deal
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contact.deals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No deals yet. Click "Add Deal" to create one.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contact.deals.map((deal) => {
                          const stage = getStageInfo(deal)
                          return (
                            <div
                              key={deal.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                              onClick={() => router.push(`/deals?deal=${deal.id}`)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{deal.title}</p>
                                  {deal.closedAt && (
                                    <Badge variant={deal.stage === 'closed' ? 'default' : 'destructive'}>
                                      {deal.stage === 'closed' ? 'Won' : 'Lost'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                  {stage && (
                                    <Badge
                                      variant="secondary"
                                      style={{
                                        backgroundColor: `${stage.color}20`,
                                        color: stage.color,
                                      }}
                                    >
                                      {stage.name}
                                    </Badge>
                                  )}
                                  <span>{deal.pipeline.name}</span>
                                  {deal.expectedCloseDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(deal.expectedCloseDate), 'MMM d')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">
                                  {formatCurrency(deal.value, deal.currency)}
                                </p>
                                {deal.assignedUser && (
                                  <div className="flex items-center gap-1 justify-end mt-1">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={deal.assignedUser.avatarUrl || undefined} />
                                      <AvatarFallback className="text-xs">
                                        {getInitials(deal.assignedUser.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground">
                                      {deal.assignedUser.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="conversations" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Conversations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contact.conversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No conversations yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contact.conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                            onClick={() => openConversation(conv.id)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                <Badge variant={conv.status === 'OPEN' ? 'default' : 'secondary'}>
                                  {conv.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {conv._count.messages} messages
                                </span>
                              </div>
                              {conv.messages[0] && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                                  {conv.messages[0].content}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {conv.lastMessageAt
                                  ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
                                  : '-'}
                              </p>
                              <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Activity History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contact.activities.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No activities recorded.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contact.activities.map((activity) => {
                          const Icon = activityIcons[activity.type] || Activity
                          return (
                            <div key={activity.id} className="flex gap-4">
                              <div className="flex-shrink-0">
                                <div className={cn(
                                  'p-2 rounded-full',
                                  activity.completedAt ? 'bg-green-500/10' : 'bg-muted'
                                )}>
                                  <Icon className={cn(
                                    'h-4 w-4',
                                    activity.completedAt ? 'text-green-500' : 'text-muted-foreground'
                                  )} />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{activity.title}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {activity.type}
                                  </Badge>
                                  {activity.deal && (
                                    <Badge variant="secondary" className="text-xs">
                                      {activity.deal.title}
                                    </Badge>
                                  )}
                                </div>
                                {activity.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {activity.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                  </span>
                                  {activity.creator && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {activity.creator.name || 'Unknown'}
                                    </span>
                                  )}
                                  {activity.completedAt && (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-3 w-3" />
                                      Completed
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Timeline */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Timeline</CardTitle>
                <CardDescription>Recent activity and events</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {/* Combine activities, deals, and conversations into timeline */}
                    {[
                      ...contact.activities.map((a) => ({
                        type: 'activity',
                        data: a,
                        date: new Date(a.createdAt),
                      })),
                      ...contact.deals.map((d) => ({
                        type: 'deal',
                        data: d,
                        date: new Date(d.createdAt),
                      })),
                      ...contact.conversations.map((c) => ({
                        type: 'conversation',
                        data: c,
                        date: new Date(c.lastMessageAt || c.id),
                      })),
                    ]
                      .sort((a, b) => b.date.getTime() - a.date.getTime())
                      .slice(0, 20)
                      .map((item, index) => (
                        <div key={`${item.type}-${index}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              item.type === 'deal' ? 'bg-green-500/10' :
                                item.type === 'conversation' ? 'bg-blue-500/10' : 'bg-muted'
                            )}>
                              {item.type === 'deal' ? (
                                <DollarSign className="h-4 w-4 text-green-500" />
                              ) : item.type === 'conversation' ? (
                                <MessageSquare className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Activity className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            {index < 19 && <div className="w-px h-8 bg-border" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium">
                              {item.type === 'deal'
                                ? `Deal created: ${(item.data as Deal).title}`
                                : item.type === 'conversation'
                                  ? 'Conversation updated'
                                  : (item.data as ActivityItem).title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(item.date, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Deal Dialog */}
      {pipelines.length > 0 && (
        <DealDialog
          open={dealDialogOpen}
          onOpenChange={setDealDialogOpen}
          pipelineId={pipelines[0].id}
          stages={pipelines[0].stages.sort((a, b) => a.order - b.order)}
          defaultContactId={contactId}
          onSuccess={() => {
            setDealDialogOpen(false)
            fetchContact()
          }}
        />
      )}
    </div>
  )
}
