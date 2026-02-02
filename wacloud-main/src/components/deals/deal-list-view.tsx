'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2,
  Search,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit,
  Trash2,
  Filter,
  X,
  User,
  CheckCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DealDetailPanel } from './deal-detail-panel'
import { DealDialog } from './deal-dialog'
import { DealCloseDialog } from './deal-close-dialog'

interface Stage {
  id: string
  name: string
  color: string
  probability: number
  order: number
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
  assignedTo: string | null
  contact: {
    id: string
    name: string | null
    phoneNumber: string
    email: string | null
    avatarUrl: string | null
  }
  pipeline: Pipeline
  assignedUser?: TeamMember | null
  _count?: {
    activities: number
  }
  createdAt: string
}

interface DealListViewProps {
  pipelineId: string
}

type SortField = 'title' | 'value' | 'stage' | 'expectedCloseDate' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export function DealListView({ pipelineId }: DealListViewProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closingDeal, setClosingDeal] = useState<Deal | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [dealsRes, pipelineRes, teamRes] = await Promise.all([
        fetch(`/api/deals?pipelineId=${pipelineId}`),
        fetch(`/api/pipelines/${pipelineId}`),
        fetch('/api/team'),
      ])

      if (dealsRes.ok) {
        const result = await dealsRes.json()
        setDeals(result.data || [])
      }

      if (pipelineRes.ok) {
        const result = await pipelineRes.json()
        setPipeline(result.data)
      }

      if (teamRes.ok) {
        const result = await teamRes.json()
        setTeamMembers(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load deals')
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleDelete = async (dealId: string) => {
    try {
      const response = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete deal')
      toast.success('Deal deleted')
      fetchData()
    } catch (error) {
      toast.error('Failed to delete deal')
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

  const getStageInfo = (stageId: string) => {
    if (!pipeline) return null
    return pipeline.stages.find((s) => s.id === stageId)
  }

  // Filter and sort deals
  const filteredDeals = deals
    .filter((deal) => {
      const matchesSearch =
        !search ||
        deal.title.toLowerCase().includes(search.toLowerCase()) ||
        deal.contact.name?.toLowerCase().includes(search.toLowerCase()) ||
        deal.contact.phoneNumber.includes(search)

      const matchesStage = stageFilter === 'all' || deal.stage === stageFilter
      const matchesAssignee =
        assigneeFilter === 'all' ||
        (assigneeFilter === 'unassigned' && !deal.assignedTo) ||
        deal.assignedTo === assigneeFilter

      return matchesSearch && matchesStage && matchesAssignee
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'value':
          comparison = a.value - b.value
          break
        case 'stage':
          const stageA = getStageInfo(a.stage)
          const stageB = getStageInfo(b.stage)
          comparison = (stageA?.order || 0) - (stageB?.order || 0)
          break
        case 'expectedCloseDate':
          const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0
          const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0
          comparison = dateA - dateB
          break
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

  const totalValue = filteredDeals.reduce((sum, deal) => sum + deal.value, 0)

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    )
  }

  const stages = pipeline?.stages.sort((a, b) => a.order - b.order) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deals..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[250px]"
                />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(stageFilter !== 'all' || assigneeFilter !== 'all' || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setStageFilter('all')
                    setAssigneeFilter('all')
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{filteredDeals.length} deals</span>
              <span className="font-medium text-foreground">
                {formatCurrency(totalValue, 'USD')} total
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('title')}
                    className="-ml-3"
                  >
                    Deal
                    <SortIcon field="title" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('value')}
                    className="-ml-3"
                  >
                    Value
                    <SortIcon field="value" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('stage')}
                    className="-ml-3"
                  >
                    Stage
                    <SortIcon field="stage" />
                  </Button>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('expectedCloseDate')}
                    className="-ml-3"
                  >
                    Close Date
                    <SortIcon field="expectedCloseDate" />
                  </Button>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No deals found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => {
                  const stage = getStageInfo(deal.stage)
                  return (
                    <TableRow
                      key={deal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedDealId(deal.id)
                        setDetailPanelOpen(true)
                      }}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{deal.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(deal.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatCurrency(deal.value, deal.currency)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {deal.probability}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={deal.contact.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(deal.contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {deal.contact.name || deal.contact.phoneNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {deal.assignedUser ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={deal.assignedUser.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(deal.assignedUser.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {deal.assignedUser.name || deal.assignedUser.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.expectedCloseDate ? (
                          format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedDealId(deal.id)
                                setDetailPanelOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingDeal(deal)
                                setDialogOpen(true)
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setClosingDeal(deal)
                                setCloseDialogOpen(true)
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Close Deal
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(deal.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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
        </CardContent>
      </Card>

      <DealDetailPanel
        dealId={selectedDealId}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onUpdate={fetchData}
      />

      {pipeline && (
        <DealDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setEditingDeal(null)
          }}
          pipelineId={pipelineId}
          stages={stages}
          deal={editingDeal}
          onSuccess={fetchData}
        />
      )}

      {closingDeal && (
        <DealCloseDialog
          dealId={closingDeal.id}
          dealTitle={closingDeal.title}
          open={closeDialogOpen}
          onOpenChange={(open) => {
            setCloseDialogOpen(open)
            if (!open) setClosingDeal(null)
          }}
          onSuccess={fetchData}
        />
      )}
    </>
  )
}
