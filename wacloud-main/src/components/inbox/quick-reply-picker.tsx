'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { MessageSquareText, Loader2 } from 'lucide-react'

interface QuickReply {
  id: string
  title: string
  shortcut: string
  content: string
  category: string | null
  usageCount: number
}

interface Contact {
  name: string | null
  phoneNumber: string
  email: string | null
}

interface QuickReplyPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (content: string) => void
  contact?: Contact | null
  triggerRef?: React.RefObject<HTMLElement>
  searchQuery?: string
}

export function QuickReplyPicker({
  open,
  onOpenChange,
  onSelect,
  contact,
  searchQuery = '',
}: QuickReplyPickerProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchQuery)

  useEffect(() => {
    if (open) {
      fetchQuickReplies()
      setSearch(searchQuery.replace('/', ''))
    }
  }, [open, searchQuery])

  const fetchQuickReplies = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/quick-replies')
      if (response.ok) {
        const result = await response.json()
        setQuickReplies(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching quick replies:', error)
    } finally {
      setLoading(false)
    }
  }

  const personalizeContent = useCallback(
    (content: string): string => {
      if (!contact) return content

      let personalized = content
      const firstName = contact.name?.split(' ')[0] || ''

      personalized = personalized.replace(/\{\{name\}\}/gi, contact.name || 'there')
      personalized = personalized.replace(/\{\{first_name\}\}/gi, firstName || 'there')
      personalized = personalized.replace(/\{\{phone\}\}/gi, contact.phoneNumber)
      personalized = personalized.replace(/\{\{email\}\}/gi, contact.email || '')

      return personalized
    },
    [contact]
  )

  const handleSelect = async (reply: QuickReply) => {
    const content = personalizeContent(reply.content)
    onSelect(content)
    onOpenChange(false)

    // Track usage
    try {
      await fetch(`/api/quick-replies/${reply.id}`, { method: 'PATCH' })
    } catch (error) {
      // Silent fail for usage tracking
    }
  }

  // Filter replies based on search
  const filteredReplies = quickReplies.filter((reply) => {
    const searchLower = search.toLowerCase()
    return (
      reply.title.toLowerCase().includes(searchLower) ||
      reply.shortcut.toLowerCase().includes(searchLower) ||
      reply.content.toLowerCase().includes(searchLower)
    )
  })

  // Group by category
  const groupedReplies = filteredReplies.reduce((acc, reply) => {
    const category = reply.category || 'General'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(reply)
    return acc
  }, {} as Record<string, QuickReply[]>)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="hidden" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0"
        align="start"
        side="top"
        sideOffset={5}
      >
        <Command>
          <CommandInput
            placeholder="Search quick replies..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No quick replies found.</CommandEmpty>
                {Object.entries(groupedReplies).map(([category, replies]) => (
                  <CommandGroup key={category} heading={category}>
                    {replies.map((reply) => (
                      <CommandItem
                        key={reply.id}
                        value={`${reply.title} ${reply.shortcut}`}
                        onSelect={() => handleSelect(reply)}
                        className="flex flex-col items-start gap-1 py-2"
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{reply.title}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {reply.shortcut}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground pl-6">
                          {reply.content}
                        </p>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
