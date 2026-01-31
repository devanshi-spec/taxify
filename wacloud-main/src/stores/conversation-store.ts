import { create } from 'zustand'
import type { Conversation, Message, Contact } from '@/types'

interface ConversationState {
  conversations: Conversation[]
  selectedConversationId: string | null
  selectedConversation: Conversation | null
  messages: Message[]
  isLoading: boolean
  isLoadingMessages: boolean
  filter: 'all' | 'unread' | 'unassigned'
  searchQuery: string

  // Actions
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removeConversation: (id: string) => void
  selectConversation: (id: string | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  setFilter: (filter: 'all' | 'unread' | 'unassigned') => void
  setSearchQuery: (query: string) => void
  setLoading: (isLoading: boolean) => void
  setLoadingMessages: (isLoading: boolean) => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  selectedConversationId: null,
  selectedConversation: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  filter: 'all',
  searchQuery: '',

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations.filter(c => c.id !== conversation.id)],
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === id ? { ...conv, ...updates } : conv
      ),
      selectedConversation:
        state.selectedConversationId === id
          ? { ...state.selectedConversation!, ...updates }
          : state.selectedConversation,
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((conv) => conv.id !== id),
      selectedConversationId:
        state.selectedConversationId === id ? null : state.selectedConversationId,
      selectedConversation:
        state.selectedConversationId === id ? null : state.selectedConversation,
    })),

  selectConversation: (id) => {
    const conversation = id
      ? get().conversations.find((conv) => conv.id === id) || null
      : null
    set({
      selectedConversationId: id,
      selectedConversation: conversation,
      messages: [], // Clear messages when switching conversations
    })
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),
}))
