'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'

export function DelayNode({ data, selected }: NodeProps) {
  const formatDelay = (duration: number, unit: string) => {
    if (!duration || !unit) return 'No delay set'
    const unitLabel = duration === 1 ? unit.slice(0, -1) : unit
    return `${duration} ${unitLabel}`
  }

  return (
    <div
      className={`
        min-w-[150px] rounded-lg border-2 bg-gray-50 dark:bg-gray-900
        ${selected ? 'border-gray-500 shadow-lg' : 'border-gray-200 dark:border-gray-700'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-gray-500">
            <Clock className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {(data.label as string) || 'Delay'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-center text-muted-foreground">
          Wait {formatDelay(data.duration as number, data.unit as string)}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3"
      />
    </div>
  )
}
