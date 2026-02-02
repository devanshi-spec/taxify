'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

export function ConditionNode({ data, selected }: NodeProps) {
  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case 'equals':
        return '='
      case 'not_equals':
        return '≠'
      case 'contains':
        return '∋'
      case 'starts_with':
        return '^'
      case 'ends_with':
        return '$'
      case 'greater_than':
        return '>'
      case 'less_than':
        return '<'
      default:
        return '='
    }
  }

  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-orange-50 dark:bg-orange-950
        ${selected ? 'border-orange-500 shadow-lg' : 'border-orange-200 dark:border-orange-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-orange-500">
            <GitBranch className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            {(data.label as string) || 'Condition'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        {data.variable && data.value ? (
          <p className="text-xs text-center font-mono">
            <span className="text-orange-600">{data.variable as string}</span>
            <span className="mx-1">
              {getOperatorLabel((data.operator as string) || 'equals')}
            </span>
            <span className="text-orange-600">{data.value as string}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            No condition set
          </p>
        )}
      </div>
      <div className="flex border-t border-orange-200 dark:border-orange-800">
        <div className="flex-1 py-1.5 text-center border-r border-orange-200 dark:border-orange-800 relative">
          <span className="text-[10px] text-green-600 font-medium">TRUE</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!bg-green-500 !w-3 !h-3 !left-1/2 !-translate-x-1/2"
            style={{ left: '25%' }}
          />
        </div>
        <div className="flex-1 py-1.5 text-center relative">
          <span className="text-[10px] text-red-600 font-medium">FALSE</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!bg-red-500 !w-3 !h-3 !left-1/2 !-translate-x-1/2"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    </div>
  )
}
