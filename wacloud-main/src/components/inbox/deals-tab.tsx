'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DealCard } from './deal-card'
import type { Deal, Contact, Pipeline } from '@/types'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DealsTabProps {
    contact: Contact
}

export function DealsTab({ contact }: DealsTabProps) {
    const [deals, setDeals] = useState<Deal[]>([])
    const [pipelines, setPipelines] = useState<Pipeline[]>([])
    const [loading, setLoading] = useState(false)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [creating, setCreating] = useState(false)

    // New Deal Form State
    const [newDealTitle, setNewDealTitle] = useState('')
    const [newDealValue, setNewDealValue] = useState('')
    const [selectedPipelineId, setSelectedPipelineId] = useState('')
    const [selectedStageId, setSelectedStageId] = useState('')

    const fetchDeals = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/contacts/${contact.id}/deals`)
            if (response.ok) {
                const data = await response.json()
                setDeals(data.data || [])
            }
        } catch (error) {
            console.error('Error fetching deals:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchPipelines = async () => {
        try {
            const response = await fetch('/api/pipelines')
            if (response.ok) {
                const data = await response.json()
                setPipelines(data.data || [])
                // Set default pipeline
                const defaultPipeline = data.data?.find((p: Pipeline) => p.isDefault) || data.data?.[0]
                if (defaultPipeline) {
                    setSelectedPipelineId(defaultPipeline.id)
                    // Set first stage of default pipeline
                    if (defaultPipeline.stages?.length > 0) {
                        setSelectedStageId(defaultPipeline.stages[0].id)
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching pipelines:', error)
        }
    }

    useEffect(() => {
        fetchDeals()
        fetchPipelines()
    }, [contact.id])

    // When pipeline changes, reset stage
    useEffect(() => {
        if (selectedPipelineId) {
            const pipeline = pipelines.find(p => p.id === selectedPipelineId)
            if (pipeline && pipeline.stages?.length > 0) {
                setSelectedStageId(pipeline.stages[0].id)
            } else {
                setSelectedStageId('')
            }
        }
    }, [selectedPipelineId, pipelines])

    const handleCreateDeal = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDealTitle || !selectedPipelineId) {
            toast.error('Please fill in all required fields')
            return
        }

        try {
            setCreating(true)
            const response = await fetch('/api/deals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newDealTitle,
                    value: parseFloat(newDealValue) || 0,
                    stage: selectedStageId,
                    pipelineId: selectedPipelineId,
                    contactId: contact.id,
                    currency: 'USD',
                }),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to create deal')
            }

            toast.success('Deal created successfully')
            setCreateDialogOpen(false)
            fetchDeals()

            // Reset form
            setNewDealTitle('')
            setNewDealValue('')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create deal')
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteDeal = async (dealId: string) => {
        try {
            const response = await fetch(`/api/deals/${dealId}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                toast.success('Deal deleted')
                setDeals(prev => prev.filter(d => d.id !== dealId))
            }
        } catch (error) {
            toast.error('Failed to delete deal')
        }
    }

    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId)
    const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0)

    return (
        <div className="flex h-full flex-col">
            {/* Summary Header */}
            <div className="bg-muted/30 p-4 border-b">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Total Pipeline</span>
                    <span className="text-lg font-bold text-green-600">${totalValue.toLocaleString()}</span>
                </div>
                <Button size="sm" className="w-full" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Deal
                </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : deals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <div className="rounded-full bg-muted p-2 mb-2">
                            <DollarSign className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium">No active deals</p>
                        <p className="text-xs mt-1 max-w-[180px]">
                            Create a deal to track sales opportunities with this contact.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {deals.map(deal => (
                            <DealCard
                                key={deal.id}
                                deal={deal}
                                onDelete={handleDeleteDeal}
                                onEdit={(d) => console.log('Edit', d)}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Create Deal Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Deal</DialogTitle>
                        <DialogDescription>
                            Create a sales opportunity for {contact.name || contact.phoneNumber}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateDeal} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Deal Title *</Label>
                            <Input
                                placeholder="e.g. Enterprise License"
                                value={newDealTitle}
                                onChange={e => setNewDealTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Value (USD)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newDealValue}
                                    onChange={e => setNewDealValue(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Pipeline</Label>
                                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select pipeline" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pipelines.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Stage</Label>
                            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select stage" />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedPipeline?.stages?.map(stage => (
                                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={creating || !selectedPipelineId}>
                                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Create Deal
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
