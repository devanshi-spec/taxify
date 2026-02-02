'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Zap, ArrowRight, Activity, Filter, Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface AutomationRule {
    id: string
    name: string
    triggerType: string
    actionType: string
    isActive: boolean
    triggerConfig: any
    actionConfig: any
}

interface Flow {
    id: string
    name: string
}

export default function AutomationDashboard() {
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const queryClient = useQueryClient()

    const { data: rules, isLoading } = useQuery({
        queryKey: ['automation-rules'],
        queryFn: async () => {
            const res = await fetch('/api/automation/rules')
            if (!res.ok) throw new Error('Failed to fetch rules')
            return res.json()
        }
    })

    // Fetch flows for configuration
    const { data: flows } = useQuery({
        queryKey: ['flows'],
        queryFn: async () => {
            // Assuming a generic flows endpoint exists, if not need to create one or use existing
            const res = await fetch('/api/flows')
            if (!res.ok) return { data: [] }
            return res.json()
        },
        enabled: isCreateOpen // Only fetch when dialog opens
    })

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/automation/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) throw new Error('Failed to create rule')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
            setIsCreateOpen(false)
            toast.success('Automation rule created')
            setNewRule({
                name: '',
                triggerType: 'FLOW_COMPLETED',
                actionType: 'ADD_TAG',
                triggerConfig: {},
                actionConfig: {}
            })
        },
        onError: () => toast.error('Failed to create rule')
    })

    const [newRule, setNewRule] = useState({
        name: '',
        triggerType: 'FLOW_COMPLETED',
        actionType: 'ADD_TAG',
        triggerConfig: {} as Record<string, any>,
        actionConfig: {} as Record<string, any>
    })

    const handleCreate = () => {
        createMutation.mutate(newRule)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Automation</h2>
                    <p className="text-muted-foreground">
                        Connect your workflows with intelligent triggers and actions.
                    </p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            New Automation
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Create Automation Rule</DialogTitle>
                            <DialogDescription>
                                Define a trigger and an action to automate your CRM.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Rule Name</Label>
                                <Input
                                    id="name"
                                    value={newRule.name}
                                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                    placeholder="e.g., Tag New Leads from Welcome Flow"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>When Trigger...</Label>
                                    <Select
                                        value={newRule.triggerType}
                                        onValueChange={(val) => setNewRule({ ...newRule, triggerType: val, triggerConfig: {} })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FLOW_COMPLETED">Flow Completed</SelectItem>
                                            <SelectItem value="DEAL_STAGE_CHANGED">Deal Stage Changed</SelectItem>
                                            <SelectItem value="CONTACT_CREATED">Contact Created</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Do Action...</Label>
                                    <Select
                                        value={newRule.actionType}
                                        onValueChange={(val) => setNewRule({ ...newRule, actionType: val, actionConfig: {} })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADD_TAG">Add Tag</SelectItem>
                                            <SelectItem value="CREATE_DEAL">Create Deal</SelectItem>
                                            <SelectItem value="SEND_MESSAGE">Send Message</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Dynamic Trigger Config */}
                            {newRule.triggerType === 'FLOW_COMPLETED' && (
                                <div className="grid gap-2 rounded-md bg-muted/50 p-3">
                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Trigger Settings</Label>
                                    <Label>Select Flow</Label>
                                    <Select
                                        value={newRule.triggerConfig.flowId}
                                        onValueChange={(val) => setNewRule({ ...newRule, triggerConfig: { ...newRule.triggerConfig, flowId: val } })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a flow..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Any Flow</SelectItem>
                                            {flows?.data?.map((f: Flow) => (
                                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Dynamic Action Config */}
                            <div className="grid gap-2 rounded-md bg-muted/50 p-3">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Action Settings</Label>

                                {newRule.actionType === 'ADD_TAG' && (
                                    <div className="grid gap-2">
                                        <Label>Tag Name</Label>
                                        <Input
                                            placeholder="e.g. Hot Lead"
                                            value={newRule.actionConfig.tag || ''}
                                            onChange={(e) => setNewRule({ ...newRule, actionConfig: { ...newRule.actionConfig, tag: e.target.value } })}
                                        />
                                    </div>
                                )}

                                {newRule.actionType === 'CREATE_DEAL' && (
                                    <div className="grid gap-2">
                                        <Label>Deal Title Template</Label>
                                        <Input
                                            placeholder="New Deal - {{name}}"
                                            value={newRule.actionConfig.title || ''}
                                            onChange={(e) => setNewRule({ ...newRule, actionConfig: { ...newRule.actionConfig, title: e.target.value } })}
                                        />
                                        <Label>Value</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={newRule.actionConfig.value || ''}
                                            onChange={(e) => setNewRule({ ...newRule, actionConfig: { ...newRule.actionConfig, value: parseFloat(e.target.value) } })}
                                        />
                                    </div>
                                )}

                                {newRule.actionType === 'SEND_MESSAGE' && (
                                    <div className="grid gap-2">
                                        <Label>Message Template</Label>
                                        <Input
                                            placeholder="Hello {{name}}, thanks for..."
                                            value={newRule.actionConfig.message || ''}
                                            onChange={(e) => setNewRule({ ...newRule, actionConfig: { ...newRule.actionConfig, message: e.target.value } })}
                                        />
                                    </div>
                                )}
                            </div>

                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Automation
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p className="text-muted-foreground">Loading rules...</p>
                ) : rules?.data?.length === 0 ? (
                    <Card className="col-span-full border-dashed p-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Zap className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium">No automations yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Create your first rule to put your CRM on autopilot.
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                            Start Automating
                        </Button>
                    </Card>
                ) : (
                    rules?.data?.map((rule: AutomationRule) => (
                        <Card key={rule.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-medium">{rule.name}</CardTitle>
                                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                                        {rule.isActive ? 'Active' : 'Paused'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Badge variant="outline" className="font-normal">{rule.triggerType}</Badge>
                                    {rule.triggerConfig?.flowId && <span className="text-xs">(Flow: {rule.triggerConfig.flowId === 'all' ? 'Any' : 'Specific'})</span>}
                                    <ArrowRight className="h-4 w-4" />
                                    <Badge variant="outline" className="font-normal">{rule.actionType}</Badge>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
