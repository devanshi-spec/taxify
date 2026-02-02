'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, LayoutGrid, List, Plus, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { DealBoard } from './deal-board'
import { DealListView } from './deal-list-view'
import { DealDialog } from './deal-dialog'
import { DealStatsWidgets } from './deal-stats-widgets'

interface Pipeline {
  id: string
  name: string
  isDefault: boolean
  stages: Array<{ id: string; name: string; color: string; probability: number; order: number }>
  _count: {
    deals: number
  }
}

type ViewMode = 'kanban' | 'list'

export function DealsPageContent() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [statsKey, setStatsKey] = useState(0)

  useEffect(() => {
    fetchPipelines()
  }, [])

  const fetchPipelines = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const result = await response.json()
        setPipelines(result.data || [])

        // Select default pipeline
        const defaultPipeline = result.data?.find((p: Pipeline) => p.isDefault)
        if (defaultPipeline) {
          setSelectedPipeline(defaultPipeline.id)
        } else if (result.data?.length > 0) {
          setSelectedPipeline(result.data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshStats = () => {
    setStatsKey((prev) => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deals</h2>
          <p className="text-muted-foreground">
            Manage your sales pipeline and track deals
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Stats
            {showStats ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {/* Pipeline selector */}
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name} ({pipeline._count.deals})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-r-none ${viewMode === 'kanban' ? 'bg-accent' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-l-none ${viewMode === 'list' ? 'bg-accent' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Add Deal Button */}
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {selectedPipeline ? (
          <>
            {/* Stats Widgets */}
            {showStats && (
              <DealStatsWidgets key={statsKey} pipelineId={selectedPipeline} />
            )}

            {/* Board or List */}
            {viewMode === 'kanban' ? (
              <DealBoard pipelineId={selectedPipeline} />
            ) : (
              <DealListView pipelineId={selectedPipeline} />
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No pipeline selected
          </div>
        )}
      </div>

      {/* Add Deal Dialog */}
      {selectedPipeline && pipelines.length > 0 && (
        <DealDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pipelineId={selectedPipeline}
          stages={pipelines.find(p => p.id === selectedPipeline)?.stages.sort((a, b) => a.order - b.order) || []}
          onSuccess={() => {
            setDialogOpen(false)
            refreshStats()
          }}
        />
      )}
    </div>
  )
}
