'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  OnConnect,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Save, Play, Undo, Redo, Loader2, CheckCircle, MessageSquare, HelpCircle, Clock, Zap, GitBranch } from 'lucide-react'
import { toast } from 'sonner'

interface HistoryState {
  nodes: Node[]
  edges: Edge[]
}

interface TestStep {
  nodeId: string
  nodeType: string
  label: string
  status: 'pending' | 'active' | 'completed'
  message?: string
}
import { NodePalette } from './node-palette'
import { NodeEditor } from './node-editor'
import { MessageNode } from './nodes/message-node'
import { QuestionNode } from './nodes/question-node'
import { ConditionNode } from './nodes/condition-node'
import { ActionNode } from './nodes/action-node'
import { DelayNode } from './nodes/delay-node'
import { StartNode } from './nodes/start-node'
import { AINode } from './nodes/ai-node'
import { MediaNode } from './nodes/media-node'
import { TemplateNode } from './nodes/template-node'

import { AIFlowGenerator } from './ai-flow-generator'

interface FlowEditorWrapperProps {
  chatbotId: string
  chatbotName: string
  initialFlowData: Record<string, unknown> | null
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  ai: AINode,
  media: MediaNode,
  template: TemplateNode,
}

const defaultNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 250, y: 50 },
    data: { label: 'Start' },
  },
]

const defaultEdges: Edge[] = []

function FlowEditor({ chatbotId, chatbotName, initialFlowData }: FlowEditorWrapperProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Parse initial data or use defaults
  const initialNodes = (initialFlowData?.nodes as Node[]) || defaultNodes
  const initialEdges = (initialFlowData?.edges as Edge[]) || defaultEdges

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)

  // AI Generator state
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false)

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: initialNodes, edges: initialEdges }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedo = useRef(false)

  // Test mode state
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testSteps, setTestSteps] = useState<TestStep[]>([])

  // Track changes for history
  useEffect(() => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false
      return
    }

    // Debounce history updates
    const timer = setTimeout(() => {
      const newState = { nodes: [...nodes], edges: [...edges] }
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push(newState)
        // Limit history to 50 states
        if (newHistory.length > 50) newHistory.shift()
        return newHistory
      })
      setHistoryIndex((prev) => Math.min(prev + 1, 49))
    }, 500)

    return () => clearTimeout(timer)
  }, [nodes, edges])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const handleUndo = useCallback(() => {
    if (!canUndo) return
    isUndoRedo.current = true
    const prevState = history[historyIndex - 1]
    setNodes(prevState.nodes)
    setEdges(prevState.edges)
    setHistoryIndex((prev) => prev - 1)
    toast.info('Undone')
  }, [canUndo, history, historyIndex, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (!canRedo) return
    isUndoRedo.current = true
    const nextState = history[historyIndex + 1]
    setNodes(nextState.nodes)
    setEdges(nextState.edges)
    setHistoryIndex((prev) => prev + 1)
    toast.info('Redone')
  }, [canRedo, history, historyIndex, setNodes, setEdges])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds))
    },
    [setEdges]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type || !reactFlowWrapper.current) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = {
        x: event.clientX - bounds.left - 75,
        y: event.clientY - bounds.top - 25,
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: getDefaultNodeData(type),
      }

      setNodes((nds) => [...nds, newNode])
    },
    [setNodes]
  )

  const getDefaultNodeData = (type: string) => {
    switch (type) {
      case 'message':
        return { label: 'Send Message', content: '' }
      case 'question':
        return { label: 'Ask Question', question: '', options: [] }
      case 'condition':
        return { label: 'Condition', variable: '', operator: 'equals', value: '' }
      case 'action':
        return { label: 'Action', actionType: 'tag', params: {} }
      case 'delay':
        return { label: 'Delay', duration: 1, unit: 'minutes' }
      case 'ai':
        return { label: 'AI Response', prompt: '', provider: 'openai', model: 'gpt-4o-mini' }
      case 'media':
        return { label: 'Send Media', mediaType: 'image', url: '', caption: '' }
      case 'template':
        return { label: 'Send Template', templateName: '', templateId: '', params: {} }
      default:
        return { label: type }
    }
  }

  const handleAiFlowGenerated = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    // Preserve the existing flow wrapper bounds for better positioning if needed, 
    // but for now we just replace the flow.
    // Ideally we might want to ask if they want to append or replace, 
    // but for "Generate Flow" replace usually makes sense or is expected behavior for V1.
    // However, to be safe, let's just set them.

    // Ensure start node exists
    if (!newNodes.some(n => n.type === 'start')) {
      newNodes.unshift({
        id: 'start',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start' },
      })
    }

    setNodes(newNodes)
    setEdges(newEdges)
  }, [setNodes, setEdges])

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        )
      )
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...data } } : null
        )
      }
    },
    [setNodes, selectedNode]
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === 'start') {
        toast.error('Cannot delete the start node')
        return
      }
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      )
      setSelectedNode(null)
    },
    [setNodes, setEdges]
  )

  const handleSave = async () => {
    try {
      setSaving(true)

      const flowData = {
        nodes,
        edges,
      }

      const response = await fetch(`/api/chatbots/${chatbotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowData,
          type: 'FLOW',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save flow')
      }

      toast.success('Flow saved successfully')
    } catch (error) {
      console.error('Error saving flow:', error)
      toast.error('Failed to save flow')
    } finally {
      setSaving(false)
    }
  }

  // Test flow simulation
  const handleTest = useCallback(async () => {
    // Find start node
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) {
      toast.error('No start node found')
      return
    }

    // Build execution path
    const buildPath = (currentNodeId: string, visited: Set<string> = new Set()): TestStep[] => {
      if (visited.has(currentNodeId)) return []
      visited.add(currentNodeId)

      const node = nodes.find((n) => n.id === currentNodeId)
      if (!node) return []

      const step: TestStep = {
        nodeId: node.id,
        nodeType: node.type || 'unknown',
        label: (node.data?.label as string) || node.type || 'Unknown',
        status: 'pending',
        message: getNodeMessage(node),
      }

      const outgoingEdges = edges.filter((e) => e.source === currentNodeId)
      const nextSteps: TestStep[] = []

      for (const edge of outgoingEdges) {
        nextSteps.push(...buildPath(edge.target, visited))
      }

      return [step, ...nextSteps]
    }

    const path = buildPath(startNode.id)
    setTestSteps(path)
    setTestDialogOpen(true)
    setTesting(true)

    // Simulate execution with delays
    for (let i = 0; i < path.length; i++) {
      setTestSteps((prev) =>
        prev.map((step, idx) => ({
          ...step,
          status: idx < i ? 'completed' : idx === i ? 'active' : 'pending',
        }))
      )
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    // Mark all as completed
    setTestSteps((prev) =>
      prev.map((step) => ({ ...step, status: 'completed' }))
    )
    setTesting(false)
    toast.success('Test completed successfully')
  }, [nodes, edges])

  const getNodeMessage = (node: Node): string => {
    const data = node.data as Record<string, unknown>
    switch (node.type) {
      case 'start':
        return 'Flow execution started'
      case 'message':
        return (data?.content as string) || 'Sending message...'
      case 'question':
        return (data?.question as string) || 'Asking user question...'
      case 'condition':
        return `Checking: ${data?.variable || 'condition'} ${data?.operator || '=='} ${data?.value || '?'}`
      case 'action':
        return `Executing: ${data?.actionType || 'action'}`
      case 'delay':
        return `Waiting ${data?.duration || 1} ${data?.unit || 'minutes'}`
      default:
        return 'Processing...'
    }
  }

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'start':
        return <Play className="h-4 w-4 text-green-500" />
      case 'message':
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'question':
        return <HelpCircle className="h-4 w-4 text-purple-500" />
      case 'condition':
        return <GitBranch className="h-4 w-4 text-orange-500" />
      case 'action':
        return <Zap className="h-4 w-4 text-yellow-500" />
      case 'delay':
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <CheckCircle className="h-4 w-4" />
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Node Palette */}
      <NodePalette />

      {/* Flow Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
          }}
        >
          <Background gap={15} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-background border rounded-lg"
          />

          {/* Toolbar */}
          <Panel position="top-right" className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || nodes.length === 0}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Test
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Editor */}
      <NodeEditor
        node={selectedNode}
        onUpdate={updateNodeData}
        onDelete={deleteNode}
      />

      {/* Test Flow Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-500" />
              Flow Test Simulation
            </DialogTitle>
            <DialogDescription>
              Simulating the execution of your chatbot flow
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3 py-4">
              {testSteps.map((step, index) => (
                <div
                  key={step.nodeId}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${step.status === 'active'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : step.status === 'completed'
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-muted'
                    }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    {step.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : step.status === 'active' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      getNodeIcon(step.nodeType)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{step.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {step.nodeType}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {step.message}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>
              ))}
              {testSteps.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No steps to execute</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {testing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running simulation...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Simulation complete
                </span>
              )}
            </div>
            <Button onClick={() => setTestDialogOpen(false)} disabled={testing}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function FlowEditorWrapper(props: FlowEditorWrapperProps) {
  return (
    <ReactFlowProvider>
      <FlowEditor {...props} />
    </ReactFlowProvider>
  )
}
