'use client'

import { useState, useEffect } from 'react'
import { Search, MoreVertical, Loader2, Wifi, WifiOff, UserCheck, CheckCircle, Bot, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'
import { useConversationStore } from '@/stores/conversation-store'
import { useRealtimeConversations } from '@/hooks/use-realtime'
import type { Conversation } from '@/types'

interface ConversationListProps {
  organizationId?: string
  onSelectConversation?: (conversation: Conversation) => void
}

export function ConversationList({ organizationId, onSelectConversation }: ConversationListProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(true)

  const {
    conversations,
    setConversations,
    selectedConversationId,
    selectConversation,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
  } = useConversationStore()

  // Subscribe to realtime conversation updates
  useRealtimeConversations({
    organizationId,
    onNewConversation: (conv) => {
      // Optionally show notification for new conversation
    },
  })

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (filter === 'unread') params.set('status', 'OPEN')
        if (filter === 'unassigned') params.set('assignedTo', 'null')
        if (searchQuery) params.set('search', searchQuery)

        const response = await fetch(`/api/conversations?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setConversations(data.data || [])
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error)
        setIsConnected(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [filter, setConversations])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Re-fetch with search query
      if (searchQuery) {
        fetch(`/api/conversations?search=${encodeURIComponent(searchQuery)}`)
          .then((res) => res.json())
          .then((data) => setConversations(data.data || []))
          .catch(console.error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, setConversations])

  // Deduplicate conversations by contact ID
  const filteredConversations = conversations
    .filter((conv) => {
      if (filter === 'unread' && conv.unreadCount === 0) return false
      if (filter === 'unassigned' && conv.assignedTo) return false
      return true
    })
    .reduce((acc, current) => {
      const contactId = current.contact?.id;
      if (contactId) {
        const x = acc.find(item => item.contact?.id === contactId);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }
      // If no contact ID, ensure uniqueness by conversation ID (filteredConversations logic basically passes it through)
      // We still check if this conversation ID is already added to be safe, though store dedupe handles it
      const y = acc.find(item => item.id === current.id);
      if (!y) return acc.concat([current]);
      return acc;
    }, [] as Conversation[])

  const handleSelectConversation = (conversation: Conversation) => {
    selectConversation(conversation.id)
    onSelectConversation?.(conversation)
  }

  // Handle assign to me
  const handleAssignToMe = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignToSelf: true }),
      })
      if (response.ok) {
        toast.success('Assigned to you')
        // Refresh conversations
        const params = new URLSearchParams()
        if (filter === 'unread') params.set('status', 'OPEN')
        if (filter === 'unassigned') params.set('assignedTo', 'null')
        const res = await fetch(`/api/conversations?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setConversations(data.data || [])
        }
      } else {
        toast.error('Failed to assign')
      }
    } catch (error) {
      toast.error('Failed to assign')
    }
  }

  // Handle mark as resolved
  const handleMarkAsResolved = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      })
      if (response.ok) {
        toast.success('Marked as resolved')
        // Refresh conversations
        const params = new URLSearchParams()
        if (filter === 'unread') params.set('status', 'OPEN')
        if (filter === 'unassigned') params.set('assignedTo', 'null')
        const res = await fetch(`/api/conversations?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setConversations(data.data || [])
        }
      } else {
        toast.error('Failed to update')
      }
    } catch (error) {
      toast.error('Failed to update')
    }
  }

  // Handle toggle AI
  const handleToggleAi = async (conversationId: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAiEnabled: !currentState }),
      })
      if (response.ok) {
        toast.success(currentState ? 'AI disabled' : 'AI enabled')
        // Refresh conversations
        const params = new URLSearchParams()
        if (filter === 'unread') params.set('status', 'OPEN')
        if (filter === 'unassigned') params.set('assignedTo', 'null')
        const res = await fetch(`/api/conversations?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setConversations(data.data || [])
        }
      } else {
        toast.error('Failed to update')
      }
    } catch (error) {
      toast.error('Failed to update')
    }
  }

  // Handle close conversation
  const handleCloseConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      })
      if (response.ok) {
        toast.success('Conversation closed')
        // Refresh conversations
        const params = new URLSearchParams()
        if (filter === 'unread') params.set('status', 'OPEN')
        if (filter === 'unassigned') params.set('assignedTo', 'null')
        const res = await fetch(`/api/conversations?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setConversations(data.data || [])
        }
      } else {
        toast.error('Failed to close')
      }
    } catch (error) {
      toast.error('Failed to close')
    }
  }

  return (
    <div className="flex h-full flex-col bg-card min-h-0">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Conversations</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {isConnected ? 'Real-time connected' : 'Disconnected'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread' | 'unassigned')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="text-xs">
              Unassigned
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    'group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent',
                    selectedConversationId === conversation.id && 'bg-accent'
                  )}
                >
                  <Avatar>
                    <AvatarImage src={conversation.contact?.avatarUrl || undefined} />
                    <AvatarFallback>
                      {conversation.contact?.name?.[0] || conversation.contact?.phoneNumber?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {conversation.contact?.name || conversation.contact?.phoneNumber || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {conversation.lastMessageAt
                          ? formatDistanceToNow(new Date(conversation.lastMessageAt), {
                            addSuffix: true,
                          })
                          : ''}
                      </span>
                    </div>

                    <p className="truncate text-sm text-muted-foreground">
                      {conversation.lastMessagePreview || 'No messages yet'}
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      {conversation.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 rounded-full px-1.5">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                      {conversation.isAiEnabled && (
                        <Badge variant="secondary" className="h-5 text-xs">
                          AI
                        </Badge>
                      )}
                      <Badge
                        variant={
                          conversation.status === 'OPEN'
                            ? 'default'
                            : conversation.status === 'PENDING'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="h-5 text-xs"
                      >
                        {conversation.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => handleAssignToMe(conversation.id, e)}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Assign to me
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleMarkAsResolved(conversation.id, e)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark as resolved
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleToggleAi(conversation.id, conversation.isAiEnabled, e)}>
                        <Bot className="mr-2 h-4 w-4" />
                        {conversation.isAiEnabled ? 'Disable AI' : 'Enable AI'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => handleCloseConversation(conversation.id, e)}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Close conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {filteredConversations.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No conversations found
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
