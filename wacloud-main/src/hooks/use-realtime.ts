'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConversationStore } from '@/stores/conversation-store'
import type { Message, Conversation } from '@/types'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UseRealtimeMessagesOptions {
  conversationId: string | null
  onNewMessage?: (message: Message) => void
  onMessageUpdate?: (message: Message) => void
}

export function useRealtimeMessages({
  conversationId,
  onNewMessage,
  onMessageUpdate,
}: UseRealtimeMessagesOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { addMessage, updateMessage } = useConversationStore()

  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()

    // Subscribe to messages for this conversation
    channelRef.current = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const message = payload.new as Message
          addMessage(message)
          onNewMessage?.(message)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const message = payload.new as Message
          updateMessage(message.id, message)
          onMessageUpdate?.(message)
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [conversationId, addMessage, updateMessage, onNewMessage, onMessageUpdate])
}

interface UseRealtimeConversationsOptions {
  organizationId?: string
  onNewConversation?: (conversation: Conversation) => void
  onConversationUpdate?: (conversation: Conversation) => void
}

export function useRealtimeConversations({
  organizationId,
  onNewConversation,
  onConversationUpdate,
}: UseRealtimeConversationsOptions = {}) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { addConversation, updateConversation } = useConversationStore()

  useEffect(() => {
    const supabase = createClient()

    const filter = organizationId
      ? `organization_id=eq.${organizationId}`
      : undefined

    channelRef.current = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Conversation>) => {
          const conversation = payload.new as Conversation
          addConversation(conversation)
          onNewConversation?.(conversation)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Conversation>) => {
          const conversation = payload.new as Conversation
          updateConversation(conversation.id, conversation)
          onConversationUpdate?.(conversation)
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [organizationId, addConversation, updateConversation, onNewConversation, onConversationUpdate])
}
