'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'

export function MessageNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-blue-50 dark:bg-blue-950
        ${selected ? 'border-blue-500 shadow-lg' : 'border-blue-200 dark:border-blue-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-500">
            <MessageSquare className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {(data.label as string) || 'Message'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {(data.content as string) || 'No message content'}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  )
}
