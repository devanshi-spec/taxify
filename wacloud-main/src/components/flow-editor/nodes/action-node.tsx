'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { Zap, Tag, User, Webhook, ArrowRight } from 'lucide-react'

export function ActionNode({ data, selected }: NodeProps) {
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'tag':
      case 'remove_tag':
        return Tag
      case 'assign_agent':
        return User
      case 'webhook':
        return Webhook
      case 'handoff':
        return ArrowRight
      default:
        return Zap
    }
  }

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'tag':
        return 'Add Tag'
      case 'remove_tag':
        return 'Remove Tag'
      case 'set_variable':
        return 'Set Variable'
      case 'assign_agent':
        return 'Assign Agent'
      case 'update_stage':
        return 'Update Stage'
      case 'webhook':
        return 'Webhook'
      case 'handoff':
        return 'Human Handoff'
      default:
        return 'Action'
    }
  }

  const ActionIcon = getActionIcon((data.actionType as string) || 'tag')

  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-green-50 dark:bg-green-950
        ${selected ? 'border-green-500 shadow-lg' : 'border-green-200 dark:border-green-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-green-500">
            <ActionIcon className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {(data.label as string) || 'Action'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-green-600 dark:text-green-400">
          {getActionLabel((data.actionType as string) || 'tag')}
        </p>
        {typeof data.tagName === 'string' && data.tagName && (
          <p className="text-xs text-muted-foreground mt-1">
            Tag: {data.tagName}
          </p>
        )}
        {typeof data.stage === 'string' && data.stage && (
          <p className="text-xs text-muted-foreground mt-1">
            Stage: {data.stage}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-500 !w-3 !h-3"
      />
    </div>
  )
}
