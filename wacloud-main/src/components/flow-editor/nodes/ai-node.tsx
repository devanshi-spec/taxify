'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { Bot } from 'lucide-react'

export function AINode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-violet-50 dark:bg-violet-950
        ${selected ? 'border-violet-500 shadow-lg' : 'border-violet-200 dark:border-violet-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-violet-500">
            <Bot className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            {(data.label as string) || 'AI Response'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {(data.prompt as string)?.slice(0, 50) || 'Generate AI response'}
          {(data.prompt as string)?.length > 50 ? '...' : ''}
        </p>
        <div className="mt-1 flex gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400">
            {(data.provider as string) || 'openai'}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-violet-500 !w-3 !h-3"
      />
    </div>
  )
}
