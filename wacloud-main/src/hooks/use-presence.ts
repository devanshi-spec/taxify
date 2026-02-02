'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresenceState {
  oderId: string
  userName: string | null
  userAvatarUrl: string | null
  onlineAt: string
  isTyping: boolean
  typingIn: string | null // conversation ID where user is typing
}

interface UsePresenceOptions {
  oderId: string
  userName: string | null
  userAvatarUrl: string | null
  roomName?: string
}

export function usePresence({
  oderId,
  userName,
  userAvatarUrl,
  roomName = 'global',
}: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState>>({})
  const [typingUsers, setTypingUsers] = useState<Record<string, PresenceState>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const supabase = createClient()

    channelRef.current = supabase.channel(`presence:${roomName}`, {
      config: {
        presence: {
          key: oderId,
        },
      },
    })

    channelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = channelRef.current?.presenceState() || {}
        const users: Record<string, PresenceState> = {}
        const typing: Record<string, PresenceState> = {}

        Object.entries(state).forEach(([key, presences]) => {
          const presence = (presences as unknown as PresenceState[])[0]
          if (presence) {
            users[key] = presence
            if (presence.isTyping) {
              typing[key] = presence
            }
          }
        })

        setOnlineUsers(users)
        setTypingUsers(typing)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presence = (newPresences as unknown as PresenceState[])[0]
        if (presence) {
          setOnlineUsers((prev) => ({ ...prev, [key]: presence }))
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const newState = { ...prev }
          delete newState[key]
          return newState
        })
        setTypingUsers((prev) => {
          const newState = { ...prev }
          delete newState[key]
          return newState
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current?.track({
            oderId,
            userName,
            userAvatarUrl,
            onlineAt: new Date().toISOString(),
            isTyping: false,
            typingIn: null,
          })
        }
      })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [oderId, userName, userAvatarUrl, roomName])

  const startTyping = useCallback(
    async (conversationId: string) => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      await channelRef.current?.track({
        oderId,
        userName,
        userAvatarUrl,
        onlineAt: new Date().toISOString(),
        isTyping: true,
        typingIn: conversationId,
      })

      // Auto-stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping()
      }, 3000)
    },
    [oderId, userName, userAvatarUrl]
  )

  const stopTyping = useCallback(async () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    await channelRef.current?.track({
      oderId,
      userName,
      userAvatarUrl,
      onlineAt: new Date().toISOString(),
      isTyping: false,
      typingIn: null,
    })
  }, [oderId, userName, userAvatarUrl])

  const getTypingUsersInConversation = useCallback(
    (conversationId: string): PresenceState[] => {
      return Object.values(typingUsers).filter(
        (user) => user.typingIn === conversationId && user.oderId !== oderId
      )
    },
    [typingUsers, oderId]
  )

  return {
    onlineUsers,
    typingUsers,
    startTyping,
    stopTyping,
    getTypingUsersInConversation,
    onlineCount: Object.keys(onlineUsers).length,
  }
}

// Simplified typing indicator hook for a specific conversation
export function useTypingIndicator(conversationId: string | null) {
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()

    channelRef.current = supabase.channel(`typing:${conversationId}`)

    channelRef.current
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { oderId, userName, isTyping } = payload
        setTypingUsers((prev) => {
          if (isTyping && !prev.includes(userName)) {
            return [...prev, userName]
          }
          if (!isTyping) {
            return prev.filter((name) => name !== userName)
          }
          return prev
        })
      })
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [conversationId])

  const sendTyping = useCallback(
    async (oderId: string, userName: string, isTyping: boolean) => {
      if (!channelRef.current) return

      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { oderId, userName, isTyping },
      })
    },
    []
  )

  return { typingUsers, sendTyping }
}
