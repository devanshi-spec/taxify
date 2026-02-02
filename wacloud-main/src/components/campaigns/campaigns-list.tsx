'use client'

import { useState, useEffect } from 'react'
import {
  MoreVertical,
  Play,
  Pause,
  Copy,
  Trash2,
  BarChart3,
  Users,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'

interface Campaign {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  replyCount: number
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  channel?: {
    id: string
    name: string
    phoneNumber: string
  }
  // Added for duplication logic
  channelId: string
  targetSegment?: string | null
  targetTags?: string[]
  targetFilters?: Record<string, any> | null
  messageType?: string
  messageContent?: string | null
  templateId?: string | null
  templateParams?: Record<string, any> | null
  mediaUrl?: string | null
  messagesPerSecond?: number
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-500', icon: Clock },
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-500', icon: Clock },
  RUNNING: { label: 'Running', color: 'bg-yellow-500', icon: Play },
  PAUSED: { label: 'Paused', color: 'bg-orange-500', icon: Pause },
  COMPLETED: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-500', icon: AlertCircle },
}

interface CampaignsListProps {
  filter: string
  onEdit?: (campaign: Campaign) => void
}

export function CampaignsList({ filter, onEdit }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/campaigns'
        : `/api/campaigns?status=${filter}`
      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        setCampaigns(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [filter])

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/campaigns/${deleteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete campaign')
      }

      toast.success('Campaign deleted')
      setDeleteId(null)
      fetchCampaigns()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete campaign')
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        toast.success(`Campaign ${newStatus.toLowerCase()}`)
        fetchCampaigns()
      } else {
        toast.error('Failed to update campaign status')
      }
    } catch (error) {
      toast.error('Failed to update campaign status')
    }
  }

  // Handle duplicate campaign
  const handleDuplicate = async (campaign: Campaign) => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${campaign.name} (Copy)`,
          description: campaign.description || undefined,
          type: campaign.type,
          channelId: campaign.channel?.id || campaign.channelId,
          targetSegment: campaign.targetSegment || undefined,
          targetTags: campaign.targetTags || [],
          targetFilters: campaign.targetFilters || {},
          messageType: campaign.messageType || 'TEXT',
          messageContent: campaign.messageContent || undefined,
          templateId: campaign.templateId || undefined,
          templateParams: campaign.templateParams || {},
          mediaUrl: campaign.mediaUrl || undefined,
          messagesPerSecond: campaign.messagesPerSecond,
        }),
      })

      if (response.ok) {
        toast.success('Campaign duplicated')
        fetchCampaigns()
      } else {
        toast.error('Failed to duplicate campaign')
      }
    } catch (error) {
      toast.error('Failed to duplicate campaign')
    }
  }

  // Handle execute campaign
  const handleExecute = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: 'POST',
      })

      if (response.ok) {
        toast.success('Campaign execution started')
        fetchCampaigns()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to execute campaign')
      }
    } catch (error) {
      toast.error('Failed to execute campaign')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Send className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No campaigns found</h3>
        <p className="text-sm text-muted-foreground">
          {filter === 'all'
            ? 'Create your first campaign to start reaching your audience'
            : `No ${filter.toLowerCase()} campaigns`}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const status = statusConfig[campaign.status] || statusConfig.DRAFT
          const StatusIcon = status.icon
          const progress =
            campaign.totalRecipients > 0
              ? (campaign.sentCount / campaign.totalRecipients) * 100
              : 0
          const deliveryRate =
            campaign.sentCount > 0
              ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(1)
              : 0
          const readRate =
            campaign.deliveredCount > 0
              ? ((campaign.readCount / campaign.deliveredCount) * 100).toFixed(1)
              : 0

          return (
            <Card key={campaign.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {campaign.description || 'No description'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(campaign)}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {campaign.status === 'DRAFT' && campaign.totalRecipients > 0 && (
                        <DropdownMenuItem
                          onClick={() => handleExecute(campaign.id)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Execute Now
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'DRAFT' && campaign.totalRecipients === 0 && (
                        <DropdownMenuItem
                          onClick={() => onEdit?.(campaign)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Add Recipients
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'DRAFT' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(campaign.id, 'SCHEDULED')}
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          Schedule Campaign
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'RUNNING' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(campaign.id, 'PAUSED')}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause Campaign
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'PAUSED' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(campaign.id, 'RUNNING')}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume Campaign
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(campaign.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status and type */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <span className={`h-2 w-2 rounded-full ${status.color}`} />
                    {status.label}
                  </Badge>
                  <Badge variant="outline">{campaign.type}</Badge>
                </div>

                {/* Progress (for running/completed campaigns) */}
                {(campaign.status === 'RUNNING' ||
                  campaign.status === 'COMPLETED') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>
                          {campaign.sentCount.toLocaleString()} /{' '}
                          {campaign.totalRecipients.toLocaleString()}
                        </span>
                      </div>
                      <ProgressBar value={progress} />
                    </div>
                  )}

                {/* Stats */}
                {campaign.status === 'COMPLETED' && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{deliveryRate}%</div>
                      <div className="text-xs text-muted-foreground">
                        Delivered
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{readRate}%</div>
                      <div className="text-xs text-muted-foreground">Read</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {campaign.replyCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Replies</div>
                    </div>
                  </div>
                )}

                {/* Scheduled info */}
                {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Scheduled for{' '}
                      {format(new Date(campaign.scheduledAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}

                {/* Recipients for draft */}
                {campaign.status === 'DRAFT' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {campaign.totalRecipients > 0
                        ? `${campaign.totalRecipients} recipients`
                        : 'No recipients selected'}
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    Created{' '}
                    {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
                  </span>
                  {campaign.completedAt && (
                    <span>
                      Completed{' '}
                      {formatDistanceToNow(new Date(campaign.completedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
