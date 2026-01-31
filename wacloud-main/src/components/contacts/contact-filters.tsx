'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, X, Users, Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const stages = [
  { value: 'NEW', label: 'New' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'CHURNED', label: 'Churned' },
]

const defaultTags = ['VIP', 'Interested', 'Premium', 'Returning', 'Product A', 'Product B']

interface Segment {
  id: string
  name: string
  count: number
}

interface ContactFiltersProps {
  onFiltersChange?: (filters: Record<string, string>) => void
}

export function ContactFilters({ onFiltersChange }: ContactFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [stage, setStage] = useState(searchParams.get('stage') || '')
  const [segment, setSegment] = useState(searchParams.get('segment') || '')
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags')?.split(',').filter(Boolean) || []
  )
  const [optedInOnly, setOptedInOnly] = useState(searchParams.get('isOptedIn') === 'true')

  // Segments data
  const [segments, setSegments] = useState<Segment[]>([])
  const [loadingSegments, setLoadingSegments] = useState(false)

  // Segment dialog
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false)
  const [newSegmentName, setNewSegmentName] = useState('')

  // Fetch segments
  useEffect(() => {
    const fetchSegments = async () => {
      setLoadingSegments(true)
      try {
        const response = await fetch('/api/segments')
        if (response.ok) {
          const result = await response.json()
          setSegments(result.data || [])
        }
      } catch (error) {
        console.error('Error fetching segments:', error)
      } finally {
        setLoadingSegments(false)
      }
    }
    fetchSegments()
  }, [])

  // Update URL and notify parent
  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    // Reset to page 1 when filters change
    params.delete('page')

    const queryString = params.toString()
    router.push(queryString ? `?${queryString}` : '/contacts', { scroll: false })

    // Notify parent of filter changes
    if (onFiltersChange) {
      const filters: Record<string, string> = {}
      params.forEach((value, key) => {
        filters[key] = value
      })
      onFiltersChange(filters)
    }
  }, [searchParams, router, onFiltersChange])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters({ search: search || null })
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleStageChange = (value: string) => {
    setStage(value)
    updateFilters({ stage: value === 'all' ? null : value })
  }

  const handleSegmentChange = (value: string) => {
    setSegment(value)
    updateFilters({ segment: value === 'all' ? null : value })
  }

  const handleOptedInChange = (checked: boolean) => {
    setOptedInOnly(checked)
    updateFilters({ isOptedIn: checked ? 'true' : null })
  }

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    setSelectedTags(newTags)
    updateFilters({ tags: newTags.length > 0 ? newTags.join(',') : null })
  }

  const hasFilters = stage || segment || selectedTags.length > 0 || optedInOnly || search

  const clearFilters = () => {
    setSearch('')
    setStage('')
    setSegment('')
    setSelectedTags([])
    setOptedInOnly(false)
    router.push('/contacts', { scroll: false })
  }

  const handleCreateSegment = () => {
    if (!newSegmentName.trim()) return
    // Add to local list (will be persisted when contacts are assigned to it)
    const newSegment: Segment = {
      id: `segment-${Date.now()}`,
      name: newSegmentName.trim(),
      count: 0,
    }
    setSegments((prev) => [...prev, newSegment])
    setSegment(newSegmentName.trim())
    updateFilters({ segment: newSegmentName.trim() })
    setNewSegmentName('')
    setSegmentDialogOpen(false)
    toast.success(`Segment "${newSegmentName.trim()}" created`)
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stage filter */}
        <Select value={stage || 'all'} onValueChange={handleStageChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Segment filter */}
        <div className="flex items-center gap-1">
          <Select value={segment || 'all'} onValueChange={handleSegmentChange}>
            <SelectTrigger className="w-[160px]">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <SelectValue placeholder="All segments" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All segments</SelectItem>
              {loadingSegments ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                segments.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    <div className="flex items-center justify-between gap-2">
                      <span>{s.name}</span>
                      {s.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {s.count}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setSegmentDialogOpen(true)}
            title="Create new segment"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Tags filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Tags
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedTags.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-2">
              <p className="text-sm font-medium">Filter by tags</p>
              {defaultTags.map((tag) => (
                <div key={tag} className="flex items-center gap-2">
                  <Checkbox
                    id={tag}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                  />
                  <Label htmlFor={tag} className="text-sm font-normal cursor-pointer">
                    {tag}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Opted in filter */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="opted-in"
            checked={optedInOnly}
            onCheckedChange={(checked) => handleOptedInChange(!!checked)}
          />
          <Label htmlFor="opted-in" className="text-sm font-normal cursor-pointer">
            Opted in only
          </Label>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setSearch('')}
              />
            </Badge>
          )}
          {stage && (
            <Badge variant="secondary" className="gap-1">
              Stage: {stages.find((s) => s.value === stage)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleStageChange('all')}
              />
            </Badge>
          )}
          {segment && (
            <Badge variant="secondary" className="gap-1 bg-primary/10">
              <Users className="h-3 w-3 mr-1" />
              Segment: {segment}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleSegmentChange('all')}
              />
            </Badge>
          )}
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleTag(tag)}
              />
            </Badge>
          ))}
          {optedInOnly && (
            <Badge variant="secondary" className="gap-1">
              Opted in
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleOptedInChange(false)}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Create Segment Dialog */}
      <Dialog open={segmentDialogOpen} onOpenChange={setSegmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Segment</DialogTitle>
            <DialogDescription>
              Create a segment to group your contacts for targeted campaigns and easier management.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="segment-name">Segment Name</Label>
            <Input
              id="segment-name"
              placeholder="e.g., Premium Customers, Newsletter Subscribers"
              value={newSegmentName}
              onChange={(e) => setNewSegmentName(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSegment()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSegment} disabled={!newSegmentName.trim()}>
              Create Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
