'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChatbotsList } from '@/components/chatbots/chatbots-list'
import { ChatbotDialog } from '@/components/chatbots/chatbot-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Play } from 'lucide-react'

interface Chatbot {
  id: string
  name: string
  description: string | null
  isActive: boolean
  aiProvider: string
  aiModel: string
  flowType: string
  triggerKeywords: string[]
  triggerOnNewConversation: boolean
  systemPrompt: string | null
  temperature: number
  maxTokens: number
  handoffKeywords?: string[]
  handoffMessage?: string | null
}

export function ChatbotsPageContent() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChatbot, setEditingChatbot] = useState<Chatbot | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleAddChatbot = () => {
    setEditingChatbot(null)
    setDialogOpen(true)
  }

  const handleEditChatbot = (chatbot: Chatbot) => {
    setEditingChatbot(chatbot)
    setDialogOpen(true)
  }

  const handleSuccess = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Actions bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Chatbots</h2>
          <p className="text-muted-foreground">
            Create and manage AI-powered chatbots for automated responses
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/chatbots/playground">
              <Play className="mr-2 h-4 w-4" />
              Test Playground
            </Link>
          </Button>
          <Button onClick={handleAddChatbot}>
            <Plus className="mr-2 h-4 w-4" />
            Create Chatbot
          </Button>
        </div>
      </div>

      {/* Chatbots list */}
      <ChatbotsList key={refreshKey} onEdit={handleEditChatbot} />

      <ChatbotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chatbot={editingChatbot}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
