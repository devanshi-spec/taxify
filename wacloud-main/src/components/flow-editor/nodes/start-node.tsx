'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { PlayCircle } from 'lucide-react'

export function StartNode({ selected }: NodeProps) {
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 bg-emerald-50 dark:bg-emerald-950
        ${selected ? 'border-emerald-500 shadow-lg' : 'border-emerald-200 dark:border-emerald-800'}
      `}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-emerald-500">
          <PlayCircle className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-emerald-700 dark:text-emerald-300">Start</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3 !h-3"
      />
    </div>
  )
}
