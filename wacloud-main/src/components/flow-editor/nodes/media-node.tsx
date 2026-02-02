'use client'

import { Handle, Position, NodeProps } from '@xyflow/react'
import { Image, FileVideo, FileAudio, File } from 'lucide-react'

export function MediaNode({ data, selected }: NodeProps) {
  const mediaType = (data.mediaType as string) || 'image'

  const getIcon = () => {
    switch (mediaType) {
      case 'video': return FileVideo
      case 'audio': return FileAudio
      case 'document': return File
      default: return Image
    }
  }

  const Icon = getIcon()

  return (
    <div
      className={`
        min-w-[180px] max-w-[250px] rounded-lg border-2 bg-pink-50 dark:bg-pink-950
        ${selected ? 'border-pink-500 shadow-lg' : 'border-pink-200 dark:border-pink-800'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-pink-500 !w-3 !h-3"
      />
      <div className="px-3 py-2 border-b border-pink-200 dark:border-pink-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-pink-500">
            <Icon className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium text-pink-700 dark:text-pink-300">
            {(data.label as string) || 'Send Media'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400 uppercase">
            {mediaType}
          </span>
        </div>
        {(data.caption as string) && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {data.caption as string}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-pink-500 !w-3 !h-3"
      />
    </div>
  )
}
