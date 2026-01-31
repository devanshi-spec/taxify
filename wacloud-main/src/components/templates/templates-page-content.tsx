'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  Eye,
  Trash,
  FileText,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { TemplatePreview } from './template-preview'
import { cn } from '@/lib/utils'

type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'DRAFT'

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
    text: string
    url?: string
    phone_number?: string
  }>
}

interface Template {
  id: string
  externalId?: string | null
  name: string
  language: string
  category: string
  status: TemplateStatus
  components: TemplateComponent[]
  channel?: {
    id: string
    name: string
  }
  createdAt?: string
}

interface Channel {
  id: string
  name: string
}

const statusConfig: Record<TemplateStatus, { icon: typeof CheckCircle; color: string; bg: string }> = {
  APPROVED: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  PENDING: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  REJECTED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  PAUSED: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  DISABLED: { icon: AlertTriangle, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  DRAFT: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
}

const categoryLabels = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
}

export function TemplatesPageContent() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [templatesRes, channelsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/channels'),
      ])

      if (templatesRes.ok) {
        const result = await templatesRes.json()
        setTemplates(result.data || [])
      }

      if (channelsRes.ok) {
        const result = await channelsRes.json()
        setChannels(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    if (channels.length === 0) {
      toast.error('No channels available to sync')
      return
    }

    try {
      setSyncing(true)
      let totalSynced = 0
      const allErrors: string[] = []

      for (const channel of channels) {
        const response = await fetch('/api/templates/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: channel.id }),
        })

        if (response.ok) {
          const result = await response.json()
          totalSynced += result.synced
          allErrors.push(...result.errors)
        }
      }

      toast.success(`Synced ${totalSynced} templates`)
      if (allErrors.length > 0) {
        console.error('Sync errors:', allErrors)
      }
      fetchData()
    } catch (error) {
      console.error('Error syncing templates:', error)
      toast.error('Failed to sync templates')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTemplate) return

    try {
      const response = await fetch(`/api/templates/${deletingTemplate.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Template deleted')
        fetchData()
      } else {
        throw new Error('Failed to delete')
      }
    } catch (error) {
      toast.error('Failed to delete template')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTemplate(null)
    }
  }

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    if (channelFilter !== 'all' && template.channel?.id !== channelFilter) {
      return false
    }
    if (statusFilter !== 'all' && template.status !== statusFilter) {
      return false
    }
    if (search && !template.name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    return true
  })

  // Stats
  const stats = {
    total: templates.length,
    approved: templates.filter((t) => t.status === 'APPROVED').length,
    pending: templates.filter((t) => t.status === 'PENDING').length,
    rejected: templates.filter((t) => t.status === 'REJECTED').length,
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">WhatsApp Templates</h2>
          <p className="text-muted-foreground">
            Manage your pre-approved message templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from Meta
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  onClick={() => window.open('https://business.facebook.com/wa/manage/message-templates/', '_blank')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Opens Meta Business Manager to create templates</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No templates found</p>
                    <Button variant="outline" size="sm" onClick={handleSync}>
                      Sync from Meta
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => {
                const StatusIcon = statusConfig[template.status]?.icon || Clock
                const statusColor = statusConfig[template.status]?.color || 'text-gray-500'

                return (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categoryLabels[template.category as keyof typeof categoryLabels] ||
                          template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="uppercase">{template.language}</TableCell>
                    <TableCell>
                      {template.channel?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={cn('h-4 w-4', statusColor)} />
                        <span className={cn('text-sm', statusColor)}>
                          {template.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setPreviewTemplate(template)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeletingTemplate(template)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Preview Dialog */}
      <TemplatePreview
        template={previewTemplate}
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This will
              also delete the template from Meta and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
