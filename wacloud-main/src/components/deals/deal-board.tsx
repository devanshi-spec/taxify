'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { DealCard } from './deal-card'
import { DealDialog } from './deal-dialog'
import { DealDetailPanel } from './deal-detail-panel'
import { DealCloseDialog } from './deal-close-dialog'

interface Stage {
  id: string
  name: string
  order: number
  color: string
  probability: number
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
    avatarUrl: string | null
  }
  assignedUser?: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: string
  } | null
  _count?: {
    activities: number
  }
  createdAt: string
}

interface Pipeline {
  id: string
  name: string
  stages: Stage[]
  deals: Deal[]
}

interface StageColumnProps {
  stage: Stage
  deals: Deal[]
  onAddDeal: (stageId: string) => void
  onDealClick: (deal: Deal) => void
}

function StageColumn({ stage, deals, onAddDeal, onDealClick }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="flex-shrink-0 w-[300px]">
      <Card className={`h-full ${isOver ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
            </div>
            <Badge variant="secondary">{deals.length}</Badge>
          </div>
          <div className="text-sm font-semibold text-muted-foreground">
            {formatCurrency(totalValue)}
          </div>
        </CardHeader>
        <CardContent ref={setNodeRef} className="p-2 space-y-2 min-h-[400px]">
          <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => onDealClick(deal)}
              />
            ))}
          </SortableContext>
          <Button
            variant="ghost"
            className="w-full border-2 border-dashed"
            onClick={() => onAddDeal(stage.id)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

interface DealBoardProps {
  pipelineId: string
}

export function DealBoard({ pipelineId }: DealBoardProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closingDeal, setClosingDeal] = useState<Deal | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/pipelines/${pipelineId}`)
      if (response.ok) {
        const result = await response.json()
        setPipeline(result.data)
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error)
      toast.error('Failed to load pipeline')
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  useEffect(() => {
    fetchPipeline()
  }, [fetchPipeline])

  const handleDragStart = (event: DragStartEvent) => {
    const deal = pipeline?.deals.find((d) => d.id === event.active.id)
    if (deal) {
      setActiveDeal(deal)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDeal(null)

    const { active, over } = event
    if (!over || !pipeline) return

    const dealId = active.id as string
    const deal = pipeline.deals.find((d) => d.id === dealId)
    if (!deal) return

    // Find the target stage (could be dropping on stage or another deal)
    let targetStageId = over.id as string
    const overDeal = pipeline.deals.find((d) => d.id === over.id)
    if (overDeal) {
      targetStageId = overDeal.stage
    }

    // Check if stage actually changed
    if (deal.stage === targetStageId) return

    // Check if moving to a "closed" type stage - show close dialog
    const targetStage = (pipeline.stages as Stage[]).find(s => s.id === targetStageId)
    const isClosingStage = targetStageId === 'closed' || targetStageId === 'lost' ||
      targetStage?.name.toLowerCase().includes('closed') ||
      targetStage?.name.toLowerCase().includes('won') ||
      targetStage?.name.toLowerCase().includes('lost')

    if (isClosingStage) {
      setClosingDeal(deal)
      setCloseDialogOpen(true)
      return
    }

    // Optimistic update
    const updatedDeals = pipeline.deals.map((d) =>
      d.id === dealId ? { ...d, stage: targetStageId } : d
    )
    setPipeline({ ...pipeline, deals: updatedDeals })

    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStageId }),
      })

      if (!response.ok) {
        throw new Error('Failed to update deal')
      }

      const result = await response.json()
      // Update with server response
      const finalDeals = pipeline.deals.map((d) =>
        d.id === dealId ? { ...d, ...result.data, contact: d.contact } : d
      )
      setPipeline({ ...pipeline, deals: finalDeals })
    } catch (error) {
      // Revert on error
      setPipeline(pipeline)
      toast.error('Failed to move deal')
    }
  }

  const handleAddDeal = (stageId: string) => {
    setSelectedStage(stageId)
    setEditingDeal(null)
    setDialogOpen(true)
  }

  const handleDealClick = (deal: Deal) => {
    setSelectedDealId(deal.id)
    setDetailPanelOpen(true)
  }

  const handleEditFromDetail = (deal: Deal) => {
    setEditingDeal(deal)
    setSelectedStage(deal.stage)
    setDetailPanelOpen(false)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingDeal(null)
    setSelectedStage(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Pipeline not found
      </div>
    )
  }

  const stages = (pipeline.stages as Stage[]).sort((a, b) => a.order - b.order)

  const getDealsByStage = (stageId: string) =>
    pipeline.deals.filter((d) => d.stage === stageId)

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={getDealsByStage(stage.id)}
              onAddDeal={handleAddDeal}
              onDealClick={handleDealClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal && <DealCard deal={activeDeal} />}
        </DragOverlay>
      </DndContext>

      <DealDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        pipelineId={pipelineId}
        stages={stages}
        defaultStage={selectedStage}
        deal={editingDeal}
        onSuccess={fetchPipeline}
      />

      <DealDetailPanel
        dealId={selectedDealId}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onUpdate={fetchPipeline}
      />

      {closingDeal && (
        <DealCloseDialog
          dealId={closingDeal.id}
          dealTitle={closingDeal.title}
          open={closeDialogOpen}
          onOpenChange={(open) => {
            setCloseDialogOpen(open)
            if (!open) setClosingDeal(null)
          }}
          onSuccess={fetchPipeline}
        />
      )}
    </>
  )
}
