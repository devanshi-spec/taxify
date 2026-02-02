'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { HelpCircle } from 'lucide-react'

export function QuestionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-purple-50 dark:bg-purple-950
        ${selected ? 'border-purple-500 shadow-lg' : 'border-purple-200 dark:border-purple-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-purple-500">
            <HelpCircle className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {(data.label as string) || 'Question'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {(data.question as string) || 'No question set'}
        </p>
        {typeof data.variable === 'string' && data.variable && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            → {data.variable}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3 !h-3"
      />
    </div>
  )
}
