'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConversationStore } from '@/stores/conversation-store'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Message, Conversation } from '@/types'

interface RealtimeContextValue {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
  connectionStatus: 'disconnected',
})

export function useRealtimeContext() {
  return useContext(RealtimeContext)
}

interface RealtimeProviderProps {
  children: ReactNode
  organizationId?: string
}

export function RealtimeProvider({ children, organizationId }: RealtimeProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')

  const {
    addConversation,
    updateConversation,
    addMessage,
    updateMessage,
    selectedConversationId,
  } = useConversationStore()

  useEffect(() => {
    if (!organizationId) return

    const supabase = createClient()
    const channels: RealtimeChannel[] = []

    setConnectionStatus('connecting')

    // Subscribe to conversation changes
    const conversationsChannel = supabase
      .channel('realtime:conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch full conversation with relations
            const { data } = await supabase
              .from('conversations')
              .select(`
                *,
                contact:contacts(*),
                channel:channels(*)
              `)
              .eq('id', payload.new.id)
              .single()

            if (data) {
              addConversation(data as Conversation)
            }
          } else if (payload.eventType === 'UPDATE') {
            updateConversation(payload.new.id as string, payload.new as Partial<Conversation>)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('error')
        }
      })

    channels.push(conversationsChannel)

    // Subscribe to message changes
    const messagesChannel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const message = payload.new as Message
            // Only add message if it's for the currently selected conversation
            if (message.conversationId === selectedConversationId) {
              addMessage(message)
            }
            // Update conversation preview
            updateConversation(message.conversationId, {
              lastMessageAt: new Date(message.createdAt),
              lastMessagePreview: message.content?.slice(0, 100) || '[Media]',
            })
          } else if (payload.eventType === 'UPDATE') {
            const message = payload.new as Message
            if (message.conversationId === selectedConversationId) {
              updateMessage(message.id, message)
            }
          }
        }
      )
      .subscribe()

    channels.push(messagesChannel)

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
      setIsConnected(false)
      setConnectionStatus('disconnected')
    }
  }, [organizationId, addConversation, updateConversation, addMessage, updateMessage, selectedConversationId])

  return (
    <RealtimeContext.Provider value={{ isConnected, connectionStatus }}>
      {children}
    </RealtimeContext.Provider>
  )
}
