import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Organization, Channel } from '@/types'

interface UserState {
  user: User | null
  organization: Organization | null
  channels: Channel[]
  selectedChannelId: string | null

  // Actions
  setUser: (user: User | null) => void
  setOrganization: (organization: Organization | null) => void
  setChannels: (channels: Channel[]) => void
  addChannel: (channel: Channel) => void
  updateChannel: (id: string, updates: Partial<Channel>) => void
  removeChannel: (id: string) => void
  selectChannel: (id: string | null) => void
  reset: () => void
}

const initialState = {
  user: null,
  organization: null,
  channels: [],
  selectedChannelId: null,
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setOrganization: (organization) => set({ organization }),

      setChannels: (channels) => set({ channels }),

      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, channel],
        })),

      updateChannel: (id, updates) =>
        set((state) => ({
          channels: state.channels.map((ch) =>
            ch.id === id ? { ...ch, ...updates } : ch
          ),
        })),

      removeChannel: (id) =>
        set((state) => ({
          channels: state.channels.filter((ch) => ch.id !== id),
          selectedChannelId:
            state.selectedChannelId === id ? null : state.selectedChannelId,
        })),

      selectChannel: (id) => set({ selectedChannelId: id }),

      reset: () => set(initialState),
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        selectedChannelId: state.selectedChannelId,
      }),
    }
  )
)
