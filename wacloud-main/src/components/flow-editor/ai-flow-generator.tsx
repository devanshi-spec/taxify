'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Edge, Node } from '@xyflow/react'

interface AIFlowGeneratorProps {
    chatbotId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onFlowGenerated: (nodes: Node[], edges: Edge[]) => void
}

export function AIFlowGenerator({
    chatbotId,
    open,
    onOpenChange,
    onFlowGenerated,
}: AIFlowGeneratorProps) {
    const [description, setDescription] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    const handleGenerate = async () => {
        if (!description.trim()) {
            toast.error('Please provide a description')
            return
        }

        try {
            setIsGenerating(true)
            const response = await fetch('/api/chatbots/generate-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatbotId,
                    description,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate flow')
            }

            if (data.data?.flowData) {
                onFlowGenerated(data.data.flowData.nodes, data.data.flowData.edges)
                toast.success('Flow generated successfully!')
                onOpenChange(false)
                setDescription('') // Reset for next time
            } else {
                throw new Error('Invalid response format')
            }
        } catch (error) {
            console.error('Error generating flow:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to generate flow')
        } finally {
            setIsGenerating(false)
        }
    }

    const examples = [
        "Create a lead qualification bot that asks for name, email, company size, and budget.",
        "Build a customer support bot with options for technical support, billing, and sales.",
        "Make an appointment booking flow that collects date and time preferences.",
        "Design a feedback collection bot that asks for rating and comments."
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <Sparkles className="h-5 w-5" />
                        Generate Flow with AI
                    </DialogTitle>
                    <DialogDescription>
                        Describe the chatbot flow you want to build, and our AI will generate it for you instantly.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                            placeholder="e.g., Create a customer support bot that handles common questions about pricing, features, and technical issues..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-32 resize-none"
                            disabled={isGenerating}
                        />
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs text-muted-foreground font-medium">Try these examples:</span>
                        <div className="grid grid-cols-1 gap-2">
                            {examples.map((example, i) => (
                                <button
                                    key={i}
                                    className="text-left text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 p-2 rounded transition-colors border border-transparent hover:border-muted truncate"
                                    onClick={() => setDescription(example)}
                                    disabled={isGenerating}
                                >
                                    <Wand2 className="h-3 w-3 inline mr-2 opacity-70" />
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isGenerating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={!description.trim() || isGenerating}
                        className="min-w-[120px]"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate Flow
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
