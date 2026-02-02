
'use client'

import { useState, useTransition } from 'react'
import { Campaign, DripSequence } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, Clock, MessageSquare, ArrowDown, ExternalLink } from 'lucide-react'
// Note: We import actions from the page directory. Next.js supports this.
import { addStep, updateStep, deleteStep, toggleSequenceStatus, updateSequenceTrigger } from '@/app/(dashboard)/drip-campaigns/actions'
import { useRouter } from 'next/navigation'

type Props = {
    sequence: DripSequence & { campaigns: Campaign[] }
}

export function DripBuilder({ sequence }: Props) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleAddStep = () => {
        startTransition(async () => {
            await addStep(sequence.id)
        })
    }

    const handleToggleStatus = (checked: boolean) => {
        startTransition(async () => {
            await toggleSequenceStatus(sequence.id, checked)
        })
    }

    const handleDeleteStep = (stepId: string) => {
        if (!confirm('Are you sure you want to delete this step?')) return
        startTransition(async () => {
            await deleteStep(stepId, sequence.id)
        })
    }

    // Sort campaigns by order
    const steps = [...sequence.campaigns].sort((a, b) => (a.dripStepOrder || 0) - (b.dripStepOrder || 0))

    return (
        <div className="space-y-8">
            {/* Header Settings */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle className="text-xl">Sequence Settings</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="active-mode">Active</Label>
                        <Switch
                            id="active-mode"
                            checked={sequence.isActive}
                            onCheckedChange={handleToggleStatus}
                            disabled={isPending}
                        />
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Entry Trigger</Label>
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={sequence.entryTrigger}
                                onChange={(e) => startTransition(() => updateSequenceTrigger(sequence.id, e.target.value))}
                                disabled={isPending}
                            >
                                <option value="tag_added">Tag Added</option>
                                <option value="manual">Manual Enrollment</option>
                                <option value="form_submitted">Form Submitted</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline */}
            <div className="relative space-y-4">
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-border" />

                <div className="relative pl-14">
                    <div className="absolute left-4 top-2 h-4 w-4 rounded-full bg-primary" />
                    <div className="font-semibold text-sm text-muted-foreground pt-1">Start: {sequence.entryTrigger.replace('_', ' ')}</div>
                </div>

                {steps.map((step, index) => (
                    <div key={step.id} className="relative pl-14 group">
                        {/* Connecting Line Icon */}
                        <div className="absolute left-[1.15em] top-8 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground">
                            <ArrowDown className="h-3 w-3" />
                        </div>

                        <Card className="relative">
                            <CardHeader className="pb-3 pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="secondary">Step {index + 1}</Badge>
                                        <span className="font-medium text-sm">{step.name}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteStep(step.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {/* Configuration Row */}
                                <div className="flex items-end gap-4 p-3 bg-muted/50 rounded-md">
                                    <div className="grid gap-1.5 flex-1">
                                        <Label className="text-xs">Wait Delay</Label>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <StepDelayInput step={step} disabled={isPending} />
                                        </div>
                                    </div>
                                </div>

                                {/* Message Content Preview */}
                                <div className="space-y-2">
                                    <Label className="text-xs">Message</Label>
                                    <div className="rounded-md border p-3 text-sm min-h-[60px] whitespace-pre-wrap bg-background">
                                        {step.messageContent || <span className="text-muted-foreground italic">No content</span>}
                                    </div>
                                    <Input
                                        defaultValue={step.messageContent || ''}
                                        placeholder="Edit message content..."
                                        onBlur={(e) => startTransition(() => updateStep(step.id, { messageContent: e.target.value }))}
                                        disabled={isPending}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}

                <div className="relative pl-14 pt-4">
                    <Button variant="outline" onClick={handleAddStep} disabled={isPending} className="w-full border-dashed">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Step
                    </Button>
                </div>
            </div>
        </div>
    )
}

function StepDelayInput({ step, disabled }: { step: Campaign, disabled: boolean }) {
    const [_, startTransition] = useTransition()

    // Convert minutes to nice UI
    const minutes = step.dripDelayMinutes || 0
    // Simplified: We assume user inputs minutes for now, or hours if divisible.
    // For MVP, just numeric input of minutes.

    return (
        <div className="flex items-center gap-2">
            <Input
                type="number"
                className="w-20 h-8"
                defaultValue={minutes}
                onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    startTransition(() => updateStep(step.id, { dripDelayMinutes: val }))
                }}
                disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">minutes after previous</span>
        </div>
    )
}
