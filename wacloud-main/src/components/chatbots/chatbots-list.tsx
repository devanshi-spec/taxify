'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Bot,
  MoreVertical,
  Settings,
  Copy,
  Trash2,
  Zap,
  MessageSquare,
  Clock,
  Brain,
  Loader2,
  GitBranch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDistanceToNow } from 'date-fns'
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
  createdAt: string
}

const flowTypeLabels: Record<string, { label: string; description: string }> = {
  AI: { label: 'AI Powered', description: 'Uses AI to generate responses' },
  FLOW: { label: 'Flow Based', description: 'Follows predefined conversation flows' },
  HYBRID: { label: 'Hybrid', description: 'Combines flows with AI fallback' },
}

const providerIcons: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
}

interface ChatbotsListProps {
  onEdit?: (chatbot: Chatbot) => void
}

export function ChatbotsList({ onEdit }: ChatbotsListProps) {
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchChatbots = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/chatbots')
      if (response.ok) {
        const result = await response.json()
        setChatbots(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching chatbots:', error)
      toast.error('Failed to load chatbots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChatbots()
  }, [])

  const handleToggleActive = async (chatbotId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (response.ok) {
        toast.success(isActive ? 'Chatbot deactivated' : 'Chatbot activated')
        fetchChatbots()
      } else {
        toast.error('Failed to update chatbot status')
      }
    } catch (error) {
      toast.error('Failed to update chatbot status')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/chatbots/${deleteId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Chatbot deleted')
        setDeleteId(null)
        fetchChatbots()
      } else {
        toast.error('Failed to delete chatbot')
      }
    } catch (error) {
      toast.error('Failed to delete chatbot')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (chatbots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No chatbots yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first AI chatbot to automate customer conversations
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {chatbots.map((bot) => (
          <Card key={bot.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      bot.isActive ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <Bot
                      className={`h-5 w-5 ${
                        bot.isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base">{bot.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {flowTypeLabels[bot.flowType]?.label || bot.flowType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={bot.isActive}
                    onCheckedChange={() => handleToggleActive(bot.id, bot.isActive)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(bot)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/chatbots/${bot.id}/flow`}>
                          <GitBranch className="mr-2 h-4 w-4" />
                          Edit Flow
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Zap className="mr-2 h-4 w-4" />
                        Test Bot
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(bot.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {bot.description || 'No description'}
              </p>

              {/* AI Provider */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Brain className="h-3 w-3" />
                  {providerIcons[bot.aiProvider] || bot.aiProvider} - {bot.aiModel}
                </Badge>
              </div>

              {/* Trigger keywords */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Triggers
                </p>
                <div className="flex flex-wrap gap-1">
                  {bot.triggerKeywords.length > 0 ? (
                    <>
                      {bot.triggerKeywords.slice(0, 3).map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                      {bot.triggerKeywords.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{bot.triggerKeywords.length - 3}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">No triggers set</span>
                  )}
                  {bot.triggerOnNewConversation && (
                    <Badge variant="default" className="text-xs">
                      New chats
                    </Badge>
                  )}
                </div>
              </div>

              {/* Settings info */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-semibold">{bot.temperature}</div>
                    <div className="text-xs text-muted-foreground">Temperature</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-semibold">{bot.maxTokens}</div>
                    <div className="text-xs text-muted-foreground">Max tokens</div>
                  </div>
                </div>
              </div>

              {/* Flow Editor Button for FLOW/HYBRID bots */}
              {(bot.flowType === 'FLOW' || bot.flowType === 'HYBRID') && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/chatbots/${bot.id}/flow`}>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Edit Flow Canvas
                  </Link>
                </Button>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>
                  Created{' '}
                  {formatDistanceToNow(new Date(bot.createdAt), { addSuffix: true })}
                </span>
                <Badge
                  variant={bot.isActive ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {bot.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chatbot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chatbot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
