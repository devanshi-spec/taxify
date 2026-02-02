'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot, Send, User, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Chatbot {
  id: string
  name: string
  isActive: boolean
  aiProvider: string
  aiModel: string
  triggerKeywords: string[]
}

export default function ChatbotPlaygroundPage() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [selectedChatbot, setSelectedChatbot] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingChatbots, setLoadingChatbots] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchChatbots()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const fetchChatbots = async () => {
    try {
      const response = await fetch('/api/chatbots')
      if (response.ok) {
        const result = await response.json()
        setChatbots(result.data || [])
        if (result.data?.length > 0) {
          setSelectedChatbot(result.data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching chatbots:', error)
    } finally {
      setLoadingChatbots(false)
    }
  }

  const startNewConversation = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/test/chatbot/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', chatbotId: selectedChatbot }),
      })

      if (response.ok) {
        const result = await response.json()
        setConversationId(result.data.conversationId)
        setMessages([])
        toast.success('New test conversation started')
      } else {
        throw new Error('Failed to create conversation')
      }
    } catch (error) {
      toast.error('Failed to start conversation')
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !conversationId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/test/chatbot/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          conversationId,
          message: input,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.data.aiResponse) {
          const botMessage: Message = {
            id: result.data.aiResponse.id,
            role: 'assistant',
            content: result.data.aiResponse.content,
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, botMessage])
        } else {
          toast.info('No AI response - check if chatbot is active and AI is enabled')
        }
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      toast.error('Failed to get response')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const activeChatbot = chatbots.find(c => c.id === selectedChatbot)

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Chatbot Playground</h2>
        <p className="text-muted-foreground">
          Test your AI chatbot without connecting WhatsApp
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Settings</CardTitle>
            <CardDescription>Configure your test session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Chatbot</label>
              <Select
                value={selectedChatbot}
                onValueChange={setSelectedChatbot}
                disabled={loadingChatbots}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a chatbot" />
                </SelectTrigger>
                <SelectContent>
                  {chatbots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name} {bot.isActive ? '(Active)' : '(Inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeChatbot && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p><strong>Provider:</strong> {activeChatbot.aiProvider}</p>
                <p><strong>Model:</strong> {activeChatbot.aiModel}</p>
                <p><strong>Triggers:</strong> {activeChatbot.triggerKeywords.slice(0, 3).join(', ')}...</p>
              </div>
            )}

            <Button
              onClick={startNewConversation}
              disabled={!selectedChatbot || loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Start New Conversation
            </Button>

            {conversationId && (
              <p className="text-xs text-muted-foreground text-center">
                Session ID: {conversationId.slice(0, 8)}...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Chat Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Chat Test
            </CardTitle>
            <CardDescription>
              {conversationId
                ? 'Send messages to test your chatbot'
                : 'Click "Start New Conversation" to begin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col h-[500px]">
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    {conversationId
                      ? 'Send a message to start testing'
                      : 'Start a new conversation first'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                            <Bot className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[80%] ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        {msg.role === 'user' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                          <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="mt-4 flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    conversationId
                      ? 'Type a message... (try: "I need leave tomorrow")'
                      : 'Start a conversation first'
                  }
                  disabled={!conversationId || loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!conversationId || !input.trim() || loading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
