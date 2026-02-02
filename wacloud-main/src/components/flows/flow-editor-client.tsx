
'use client'

import { useState, useTransition } from 'react'
import { WhatsAppFlow } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { updateFlowJson, updateFlowStatus } from '@/app/(dashboard)/flows/actions'
import { Loader2, Save, FileJson, AlignLeft } from 'lucide-react'
import Editor from '@monaco-editor/react'

export function FlowEditorClient({ flow }: { flow: WhatsAppFlow }) {
    // Initial JSON formatting
    const initialJson = typeof flow.flowJson === 'object'
        ? JSON.stringify(flow.flowJson, null, 2)
        : String(flow.flowJson)

    const [json, setJson] = useState(initialJson)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await updateFlowJson(flow.id, json)
            if (!res.success) {
                setError(res.error || 'Failed to save')
            }
        })
    }

    const handleFormat = () => {
        try {
            const obj = JSON.parse(json)
            setJson(JSON.stringify(obj, null, 2))
            setError(null)
        } catch (e) {
            setError("Invalid JSON, cannot format")
        }
    }

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-mono">flow.json</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleFormat} disabled={isPending}>
                        <AlignLeft className="mr-2 h-4 w-4" />
                        Format
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                    {error}
                </div>
            )}

            <Card className="h-[calc(100vh-250px)] min-h-[500px] border overflow-hidden bg-background">
                <Editor
                    height="100%"
                    defaultLanguage="json"
                    defaultValue={initialJson}
                    value={json}
                    onChange={(val: string | undefined) => setJson(val || '')}
                    theme="light"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        tabSize: 2,
                        formatOnPaste: true,
                        formatOnType: true,
                    }}
                />
            </Card>
        </div>
    )
}
