'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  Zap,
  Clock,
  PlayCircle,
  Bot,
  Image,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NodeTypeConfig {
  type: string
  label: string
  icon: React.ElementType
  color: string
  description: string
}

const nodeTypes: NodeTypeConfig[] = [
  {
    type: 'message',
    label: 'Message',
    icon: MessageSquare,
    color: 'bg-blue-500',
    description: 'Send a text message',
  },
  {
    type: 'question',
    label: 'Question',
    icon: HelpCircle,
    color: 'bg-purple-500',
    description: 'Ask for user input',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    color: 'bg-orange-500',
    description: 'Branch based on conditions',
  },
  {
    type: 'action',
    label: 'Action',
    icon: Zap,
    color: 'bg-green-500',
    description: 'Perform an action',
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: Clock,
    color: 'bg-gray-500',
    description: 'Wait before continuing',
  },
  {
    type: 'ai',
    label: 'AI Response',
    icon: Bot,
    color: 'bg-violet-500',
    description: 'Generate AI response',
  },
  {
    type: 'media',
    label: 'Media',
    icon: Image,
    color: 'bg-pink-500',
    description: 'Send image, video, or file',
  },
  {
    type: 'template',
    label: 'Template',
    icon: FileText,
    color: 'bg-teal-500',
    description: 'Send WhatsApp template',
  },
]

export function NodePalette() {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string
  ) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-64 border-r bg-card p-4 overflow-auto">
      <div className="mb-4">
        <h3 className="font-semibold text-sm mb-1">Node Types</h3>
        <p className="text-xs text-muted-foreground">
          Drag nodes onto the canvas to build your flow
        </p>
      </div>

      <div className="space-y-2">
        {/* Start Node - Not draggable, info only */}
        <div className="p-3 rounded-lg border bg-muted/50 opacity-60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500">
              <PlayCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Start</p>
              <p className="text-xs text-muted-foreground">Flow entry point</p>
            </div>
          </div>
        </div>

        {/* Draggable Nodes */}
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            className={cn(
              'p-3 rounded-lg border cursor-grab active:cursor-grabbing',
              'hover:border-primary hover:shadow-sm transition-all',
              'bg-background'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', node.color)}>
                <node.icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">{node.label}</p>
                <p className="text-xs text-muted-foreground">
                  {node.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t">
        <h4 className="font-medium text-sm mb-2">Tips</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Drag nodes to reposition them</li>
          <li>• Connect nodes by dragging from handles</li>
          <li>• Click a node to edit its properties</li>
          <li>• Use keyboard shortcuts for faster editing</li>
        </ul>
      </div>
    </div>
  )
}
