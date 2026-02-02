'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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

interface ChatbotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatbot?: Chatbot | null
  onSuccess?: () => void
}

export function ChatbotDialog({ open, onOpenChange, chatbot, onSuccess }: ChatbotDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 500,
    flowType: 'AI',
    triggerKeywords: '',
    triggerOnNewConversation: false,
    handoffKeywords: '',
    handoffMessage: '',
    isActive: false,
  })

  useEffect(() => {
    if (open) {
      if (chatbot) {
        setFormData({
          name: chatbot.name,
          description: chatbot.description || '',
          aiProvider: chatbot.aiProvider,
          aiModel: chatbot.aiModel,
          systemPrompt: chatbot.systemPrompt || '',
          temperature: chatbot.temperature,
          maxTokens: chatbot.maxTokens,
          flowType: chatbot.flowType,
          triggerKeywords: chatbot.triggerKeywords.join(', '),
          triggerOnNewConversation: chatbot.triggerOnNewConversation,
          handoffKeywords: chatbot.handoffKeywords?.join(', ') || '',
          handoffMessage: chatbot.handoffMessage || '',
          isActive: chatbot.isActive,
        })
      } else {
        setFormData({
          name: '',
          description: '',
          aiProvider: 'openai',
          aiModel: 'gpt-4o',
          systemPrompt: '',
          temperature: 0.7,
          maxTokens: 500,
          flowType: 'AI',
          triggerKeywords: '',
          triggerOnNewConversation: false,
          handoffKeywords: '',
          handoffMessage: '',
          isActive: false,
        })
      }
    }
  }, [open, chatbot])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast.error('Chatbot name is required')
      return
    }

    try {
      setLoading(true)

      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        aiProvider: formData.aiProvider,
        aiModel: formData.aiModel,
        systemPrompt: formData.systemPrompt || undefined,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        flowType: formData.flowType,
        triggerKeywords: formData.triggerKeywords ? formData.triggerKeywords.split(',').map(t => t.trim()).filter(Boolean) : [],
        triggerOnNewConversation: formData.triggerOnNewConversation,
        handoffKeywords: formData.handoffKeywords ? formData.handoffKeywords.split(',').map(t => t.trim()).filter(Boolean) : [],
        handoffMessage: formData.handoffMessage || undefined,
        isActive: formData.isActive,
      }

      const url = chatbot ? `/api/chatbots/${chatbot.id}` : '/api/chatbots'
      const method = chatbot ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${chatbot ? 'update' : 'create'} chatbot`)
      }

      toast.success(chatbot ? 'Chatbot updated successfully' : 'Chatbot created successfully')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error creating chatbot:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create chatbot')
    } finally {
      setLoading(false)
    }
  }

  const modelOptions = formData.aiProvider === 'openai'
    ? ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    : ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{chatbot ? 'Edit Chatbot' : 'Create Chatbot'}</DialogTitle>
          <DialogDescription>
            {chatbot ? 'Update chatbot configuration' : 'Configure an AI-powered chatbot for automated responses'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Chatbot Name *</Label>
                  <Input
                    id="name"
                    placeholder="Customer Support Bot"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flowType">Flow Type</Label>
                  <Select
                    value={formData.flowType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, flowType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AI">AI Powered</SelectItem>
                      <SelectItem value="FLOW">Flow Based</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Handles customer inquiries and FAQs"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* AI Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aiProvider">AI Provider</Label>
                  <Select
                    value={formData.aiProvider}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      aiProvider: value,
                      aiModel: value === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022'
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiModel">Model</Label>
                  <Select
                    value={formData.aiModel}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, aiModel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="You are a helpful customer support assistant..."
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Define the persona and base instructions for the AI.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="knowledge" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Knowledge Sources</Label>
                <p className="text-sm text-muted-foreground">
                  Add text snippets that the AI will use as context to answer user questions (RAG).
                </p>
                <div className="border rounded-md p-4 bg-muted/50 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Source Text</Label>
                    <Textarea
                      placeholder="Enter product details, return policies, or FAQs here..."
                      rows={8}
                      className="bg-background"
                      onChange={(e) => {
                        // Simplified single text source for now
                        const text = e.target.value
                        setFormData(prev => ({
                          ...prev,
                          // Store as a simple JSON structure or raw text in a field if your schema supports it
                          // For now, we append it to system prompt or use a knowledgeBase field if available
                          systemPrompt: prev.systemPrompt + '\n\nContext:\n' + text
                        }))
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      * In a production environment, this would upload files to a Vector DB.
                      For this version, we will append this context to the system prompt dynamically.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Temperature: {formData.temperature}</Label>
              <Slider
                value={[formData.temperature]}
                onValueChange={(value) => setFormData(prev => ({ ...prev, temperature: value[0] }))}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                value={formData.maxTokens}
                onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 500 }))}
                min={1}
                max={4000}
              />
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-2">
            <Label htmlFor="triggerKeywords">Trigger Keywords</Label>
            <Input
              id="triggerKeywords"
              placeholder="help, support, question"
              value={formData.triggerKeywords}
              onChange={(e) => setFormData(prev => ({ ...prev, triggerKeywords: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated keywords that activate this bot
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Trigger on new conversations</Label>
              <p className="text-xs text-muted-foreground">
                Automatically respond to new conversations
              </p>
            </div>
            <Switch
              checked={formData.triggerOnNewConversation}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, triggerOnNewConversation: checked }))}
            />
          </div>

          {/* Handoff */}
          <div className="space-y-2">
            <Label htmlFor="handoffKeywords">Handoff Keywords</Label>
            <Input
              id="handoffKeywords"
              placeholder="human, agent, speak to someone"
              value={formData.handoffKeywords}
              onChange={(e) => setFormData(prev => ({ ...prev, handoffKeywords: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="handoffMessage">Handoff Message</Label>
            <Input
              value={formData.handoffMessage}
              onChange={(e) => setFormData(prev => ({ ...prev, handoffMessage: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Activate chatbot</Label>
              <p className="text-xs text-muted-foreground">
                Enable this chatbot immediately after creation
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {chatbot ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                chatbot ? 'Update Chatbot' : 'Create Chatbot'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
