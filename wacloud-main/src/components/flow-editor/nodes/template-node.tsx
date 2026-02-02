'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { FileText } from 'lucide-react'

export function TemplateNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-teal-50 dark:bg-teal-950
        ${selected ? 'border-teal-500 shadow-lg' : 'border-teal-200 dark:border-teal-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-teal-200 dark:border-teal-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-teal-500">
            <FileText className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
            {(data.label as string) || 'Send Template'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground">
          {(data.templateName as string) || 'Select a template'}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !w-3 !h-3"
      />
    </div>
  )
}
