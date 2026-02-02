'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Bot,
  Phone,
  Video,
  Image as ImageIcon,
  File,
  FileAudio,
  FileVideo,
  FileText,
  Mic,
  X,
  Check,
  CheckCheck,
  Loader2,
  Wifi,
  WifiOff,
  MapPin,
  Download,
  User,
  UserPlus,
  Megaphone,
  CheckCircle,
  AlertCircle,
  Ban,
  Sparkles,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { format } from 'date-fns'
import { useConversationStore } from '@/stores/conversation-store'
import { useTypingIndicator } from '@/hooks/use-presence'
import { useRealtimeMessages } from '@/hooks/use-realtime'
import type { Message, Conversation, Contact } from '@/types'
import { toast } from 'sonner'
import { QuickReplyPicker } from './quick-reply-picker'
import { AssignDialog } from './assign-dialog'
import { CampaignPicker } from './campaign-picker'
import { EmojiPicker } from './emoji-picker'
import { TemplatePicker } from './template-picker'
import { ProductPicker } from './product-picker'
import type { MessageTemplate } from '@/types'

interface MediaAttachment {
  file: File
  preview: string
  type: 'image' | 'video' | 'audio' | 'document'
}

interface ChatPanelProps {
  conversation?: Conversation | null
  contact?: Contact | null
  userId?: string
  userName?: string
}

function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
    case 'SENT':
      return <Check className="h-3 w-3 text-muted-foreground" />
    case 'DELIVERED':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />
    case 'READ':
      return <CheckCheck className="h-3 w-3 text-blue-500" />
    case 'FAILED':
      return <X className="h-3 w-3 text-destructive" />
    default:
      return null
  }
}

function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null

  const text = users.length === 1
    ? `${users[0]} is typing...`
    : users.length === 2
      ? `${users[0]} and ${users[1]} are typing...`
      : `${users[0]} and ${users.length - 1} others are typing...`

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="animate-bounce delay-0">.</span>
        <span className="animate-bounce delay-100">.</span>
        <span className="animate-bounce delay-200">.</span>
      </div>
      <span>{text}</span>
    </div>
  )
}

export function ChatPanel({ conversation, contact, userId, userName }: ChatPanelProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isAiEnabled, setIsAiEnabled] = useState(false)
  const [isTogglingAi, setIsTogglingAi] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [quickReplyOpen, setQuickReplyOpen] = useState(false)
  const [quickReplySearch, setQuickReplySearch] = useState('')

  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)

  const [isBlocking, setIsBlocking] = useState(false)
  const [isMarkingResolved, setIsMarkingResolved] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const { messages, setMessages, addMessage } = useConversationStore()
  const { typingUsers, sendTyping } = useTypingIndicator(conversation?.id || null)

  // Subscribe to realtime messages
  useRealtimeMessages({
    conversationId: conversation?.id || null,
    onNewMessage: (msg) => {
      // Play notification sound for inbound messages
      if (msg.direction === 'INBOUND') {
        // Optional: play notification sound
      }
    },
  })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!conversation?.id) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const response = await fetch(`/api/conversations/${conversation.id}/messages`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [conversation?.id, setMessages])

  // Fetch AI status when conversation changes
  useEffect(() => {
    if (!conversation?.id) return

    const fetchAiStatus = async () => {
      try {
        const response = await fetch(`/api/conversations/${conversation.id}/ai`)
        if (response.ok) {
          const data = await response.json()
          setIsAiEnabled(data.data?.isAiEnabled || false)
        }
      } catch (error) {
        console.error('Failed to fetch AI status:', error)
      }
    }

    fetchAiStatus()
  }, [conversation?.id])

  // Toggle AI for conversation
  const toggleAi = async () => {
    if (!conversation?.id || isTogglingAi) return

    setIsTogglingAi(true)
    const newState = !isAiEnabled

    try {
      const response = await fetch(`/api/conversations/${conversation.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState }),
      })

      if (response.ok) {
        setIsAiEnabled(newState)
        toast.success(`AI ${newState ? 'enabled' : 'disabled'} for this conversation`)
      } else {
        throw new Error('Failed to toggle AI')
      }
    } catch (error) {
      console.error('Failed to toggle AI:', error)
      toast.error('Failed to toggle AI')
    } finally {
      setIsTogglingAi(false)
    }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio' | 'document') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (16MB max)
    const maxSize = 16 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size must be less than 16MB')
      return
    }

    // Create preview
    const preview = type === 'image' || type === 'video'
      ? URL.createObjectURL(file)
      : ''

    setAttachment({ file, preview, type })

    // Reset input
    e.target.value = ''
  }

  // Clear attachment
  const clearAttachment = () => {
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview)
    }
    setAttachment(null)
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (userId && userName && conversation?.id) {
      sendTyping(userId, userName, true)
    }
  }, [userId, userName, conversation?.id, sendTyping])

  const handleStopTyping = useCallback(() => {
    if (userId && userName) {
      sendTyping(userId, userName, false)
    }
  }, [userId, userName, sendTyping])

  const handleSend = async () => {
    const hasContent = message.trim() || attachment
    if (!hasContent || !conversation?.id || isSending) return

    const messageContent = message.trim()
    setMessage('')
    setIsSending(true)
    handleStopTyping()

    // Determine message type
    let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'TEXT'
    if (attachment) {
      switch (attachment.type) {
        case 'image': messageType = 'IMAGE'; break
        case 'video': messageType = 'VIDEO'; break
        case 'audio': messageType = 'AUDIO'; break
        case 'document': messageType = 'DOCUMENT'; break
      }
    }

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      waMessageId: null,
      direction: 'OUTBOUND',
      senderId: userId || null,
      senderName: userName || null,
      type: messageType,
      content: messageType === 'TEXT' ? messageContent : null,
      mediaUrl: attachment?.preview || null,
      mediaType: null,
      mediaMimeType: attachment?.file.type || null,
      mediaFileName: attachment?.file.name || null,
      mediaCaption: messageType !== 'TEXT' ? messageContent : null,
      templateId: null,
      templateName: null,
      templateParams: null,
      interactiveType: null,
      interactiveData: null,
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,
      reaction: null,
      reactedTo: null,
      status: 'PENDING',
      statusUpdatedAt: null,
      errorCode: null,
      errorMessage: null,
      isAiGenerated: false,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      createdAt: new Date(),
    }

    addMessage(optimisticMessage)
    scrollToBottom()

    try {
      let mediaUrl: string | null = null
      let mediaId: string | null = null

      // Upload media first if there's an attachment
      if (attachment) {
        setIsUploading(true)
        const formData = new FormData()
        formData.append('file', attachment.file)

        const uploadResponse = await fetch('/api/media', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload media')
        }

        const uploadData = await uploadResponse.json()
        mediaUrl = uploadData.data.url
        mediaId = uploadData.data.id
        setIsUploading(false)
      }

      // Send message
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: messageType,
          content: messageType === 'TEXT' ? messageContent : null,
          mediaUrl,
          mediaCaption: messageType !== 'TEXT' ? messageContent : null,
          mediaMimeType: attachment?.file.type,
          mediaFileName: attachment?.file.name,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Clear attachment after successful send
      clearAttachment()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
      setIsUploading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)
    handleTyping()

    // Check for "/" trigger for quick replies
    if (value.startsWith('/') && value.length >= 1) {
      setQuickReplySearch(value)
      setQuickReplyOpen(true)
    } else {
      setQuickReplyOpen(false)
    }
  }

  // Handle quick reply selection
  const handleQuickReplySelect = (content: string) => {
    setMessage(content)
    setQuickReplyOpen(false)
    textareaRef.current?.focus()
  }

  // Handle phone call button
  const handlePhoneCall = () => {
    toast.info('Phone calls are not supported via WhatsApp Business API. Use WhatsApp on your phone to make calls.')
  }

  // Handle video call button
  const handleVideoCall = () => {
    toast.info('Video calls are not supported via WhatsApp Business API. Use WhatsApp on your phone to make video calls.')
  }

  // Handle view contact
  const handleViewContact = () => {
    if (contact?.id) {
      router.push(`/contacts/${contact.id}`)
    }
  }

  // Handle mark as resolved
  const handleMarkAsResolved = async () => {
    if (!conversation?.id || isMarkingResolved) return

    setIsMarkingResolved(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      })

      if (response.ok) {
        toast.success('Conversation marked as resolved')
      } else {
        toast.error('Failed to mark as resolved')
      }
    } catch (error) {
      console.error('Failed to mark as resolved:', error)
      toast.error('Failed to mark as resolved')
    } finally {
      setIsMarkingResolved(false)
    }
  }

  // Handle block contact
  const handleBlockContact = async () => {
    if (!contact?.id || isBlocking) return

    setIsBlocking(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOptedIn: false }),
      })

      if (response.ok) {
        toast.success('Contact blocked. They will no longer receive messages.')
        setBlockDialogOpen(false)
      } else {
        toast.error('Failed to block contact')
      }
    } catch (error) {
      console.error('Failed to block contact:', error)
      toast.error('Failed to block contact')
    } finally {
      setIsBlocking(false)
    }
  }

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji)
    textareaRef.current?.focus()
  }

  // Handle template selection
  const handleTemplateSelect = async (template: MessageTemplate, variables: Record<string, string>) => {
    if (!conversation?.id || isSending) return

    setIsSending(true)

    // Build template params from variables
    const templateParams: { type: string; text: string }[] = Object.entries(variables)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, value]) => ({ type: 'text', text: value }))

    // Optimistic update
    let previewText = template.bodyText
    Object.entries(variables).forEach(([key, value]) => {
      previewText = previewText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    })

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      waMessageId: null,
      direction: 'OUTBOUND',
      senderId: userId || null,
      senderName: userName || null,
      type: 'TEMPLATE',
      content: previewText,
      mediaUrl: null,
      mediaType: null,
      mediaMimeType: null,
      mediaFileName: null,
      mediaCaption: null,
      templateId: template.id,
      templateName: template.name,
      templateParams: { body: templateParams },
      interactiveType: null,
      interactiveData: null,
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,
      reaction: null,
      reactedTo: null,
      status: 'PENDING',
      statusUpdatedAt: null,
      errorCode: null,
      errorMessage: null,
      isAiGenerated: false,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      createdAt: new Date(),
    }

    addMessage(optimisticMessage)
    scrollToBottom()

    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TEMPLATE',
          templateId: template.id,
          templateName: template.name,
          templateLanguage: template.language,
          templateParams: templateParams.length > 0 ? { body: templateParams } : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send template')
      }

      toast.success('Template message sent')
    } catch (error) {
      console.error('Failed to send template:', error)
      toast.error('Failed to send template message')
    } finally {
      setIsSending(false)
    }
  }

  // Handle product selection
  const handleProductSend = async (products: any[]) => {
    if (!conversation?.id || isSending || products.length === 0) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'INTERACTIVE',
          interactiveType: products.length > 1 ? 'product_list' : 'product',
          interactiveData: {
            // Simplified structure - normally needs catalog_id and product_retailer_id
            action: {
              catalog_id: products[0].waCatalogId || 'default',
              product_retailer_id: products[0].sku || products[0].id,
              sections: products.length > 1 ? [{
                title: 'Selected Products',
                product_items: products.map(p => ({ product_retailer_id: p.sku || p.id }))
              }] : undefined
            },
            body: {
              text: products.length > 1 ? 'Check out these products' : `Check out ${products[0].name}`
            }
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send product message')
      }

      toast.success('Product message sent')
    } catch (error) {
      console.error('Failed to send product:', error)
      toast.error('Failed to send product message')
    } finally {
      setIsSending(false)
    }
  }

  // Show empty state if no conversation selected

  if (!conversation || !contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="mb-4 rounded-full bg-muted p-6">
            <Phone className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No conversation selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a conversation from the list to start messaging
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden min-h-0">
      {/* Chat header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={contact.avatarUrl || undefined} />
            <AvatarFallback>{contact.name?.[0] || contact.phoneNumber?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{contact.name || contact.phoneNumber}</h3>
            <p className="text-sm text-muted-foreground">{contact.phoneNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAiEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleAi}
                  disabled={isTogglingAi}
                >
                  {isTogglingAi ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="mr-2 h-4 w-4" />
                  )}
                  AI {isAiEnabled ? 'On' : 'Off'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Toggle AI auto-responses for this conversation
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handlePhoneCall}>
                  <Phone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Phone call</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleVideoCall}>
                  <Video className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Video call</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewContact}>
                <User className="mr-2 h-4 w-4" />
                View contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Assign to team member
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCampaignPickerOpen(true)}>
                <Megaphone className="mr-2 h-4 w-4" />
                Add to campaign
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleMarkAsResolved} disabled={isMarkingResolved}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {isMarkingResolved ? 'Marking...' : 'Mark as resolved'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setBlockDialogOpen(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Block contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full p-4">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground">Send a message to start the conversation</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                      msg.isAiGenerated
                        ? 'bg-violet-600 text-white'
                        : msg.direction === 'OUTBOUND'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                    )}
                  >
                    {msg.isAiGenerated && (
                      <div className="mb-1 flex items-center gap-1 text-[10px] opacity-70">
                        <Bot className="h-3 w-3" />
                        <span>AI Response</span>
                      </div>
                    )}

                    {msg.senderName && !msg.isAiGenerated && msg.direction === 'OUTBOUND' && (
                      <div className="mb-1 text-xs font-medium opacity-70">
                        {msg.senderName}
                      </div>
                    )}

                    {/* Image */}
                    {msg.type === 'IMAGE' && msg.mediaUrl && (
                      <div className="mb-2">
                        <img
                          src={msg.mediaUrl}
                          alt="Media"
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                          onClick={() => window.open(msg.mediaUrl!, '_blank')}
                        />
                      </div>
                    )}

                    {/* Video */}
                    {msg.type === 'VIDEO' && msg.mediaUrl && (
                      <div className="mb-2">
                        <video
                          src={msg.mediaUrl}
                          controls
                          className="max-w-full rounded-lg"
                        />
                      </div>
                    )}

                    {/* Audio */}
                    {msg.type === 'AUDIO' && msg.mediaUrl && (
                      <div className="mb-2">
                        <audio src={msg.mediaUrl} controls className="w-full" />
                      </div>
                    )}

                    {/* Document */}
                    {msg.type === 'DOCUMENT' && msg.mediaUrl && (
                      <a
                        href={msg.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "mb-2 flex items-center gap-2 rounded-lg p-3 hover:opacity-90",
                          msg.direction === 'OUTBOUND' ? 'bg-primary-foreground/20' : 'bg-background/50'
                        )}
                      >
                        <File className="h-8 w-8" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {msg.mediaFileName || 'Document'}
                          </p>
                          <p className="text-xs opacity-70">
                            {msg.mediaMimeType || 'File'}
                          </p>
                        </div>
                      </a>
                    )}

                    {/* Location */}
                    {msg.type === 'LOCATION' && msg.latitude && msg.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "mb-2 flex items-center gap-2 rounded-lg p-3 hover:opacity-90",
                          msg.direction === 'OUTBOUND' ? 'bg-primary-foreground/20' : 'bg-background/50'
                        )}
                      >
                        <MapPin className="h-8 w-8" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Location</p>
                          <p className="text-xs opacity-70">
                            {msg.latitude.toFixed(6)}, {msg.longitude.toFixed(6)}
                          </p>
                        </div>
                      </a>
                    )}

                    {/* Text / Content */}
                    {(msg.content || msg.mediaCaption) && (
                      <p className="whitespace-pre-wrap">{msg.content || msg.mediaCaption}</p>
                    )}

                    <div className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px]",
                      msg.direction === 'OUTBOUND' && !msg.isAiGenerated ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      <span>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                      {msg.direction === 'OUTBOUND' && (
                        <span>
                          {msg.status === 'SENT' && <Check className="h-3 w-3" />}
                          {msg.status === 'DELIVERED' && <CheckCheck className="h-3 w-3" />}
                          {msg.status === 'READ' && <CheckCheck className="h-3 w-3 text-blue-300" />}
                          {msg.status === 'FAILED' && <AlertCircle className="h-3 w-3 text-red-300" />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Typing indicator */}
      < TypingIndicator users={typingUsers} />

      {/* Message input */}
      < div className="border-t bg-card p-4" >
        {/* Hidden file inputs */}
        < input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        < input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'document')}
        />
        < input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'audio')}
        />

        {/* Attachment preview */}
        {
          attachment && (
            <div className="mb-3 rounded-lg border bg-muted/50 p-3">
              <div className="flex items-start gap-3">
                {attachment.type === 'image' && attachment.preview && (
                  <img
                    src={attachment.preview}
                    alt="Preview"
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                )}
                {attachment.type === 'video' && attachment.preview && (
                  <video
                    src={attachment.preview}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                )}
                {attachment.type === 'audio' && (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                    <FileAudio className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {attachment.type === 'document' && (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                    <File className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{attachment.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(attachment.file.size / 1024).toFixed(1)} KB
                  </p>
                  {isUploading && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading...
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={clearAttachment}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        }

        {/* Quick Reply Picker */}
        <QuickReplyPicker
          open={quickReplyOpen}
          onOpenChange={setQuickReplyOpen}
          onSelect={handleQuickReplySelect}
          contact={contact}
          searchQuery={quickReplySearch}
        />

        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isSending}>
                  <Paperclip className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
                  <File className="mr-2 h-4 w-4" />
                  Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => audioInputRef.current?.click()}>
                  <Mic className="mr-2 h-4 w-4" />
                  Audio
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProductPickerOpen(true)}>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Product
                </DropdownMenuItem>
              </DropdownMenuContent>

            </DropdownMenu>

            <EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={isSending} />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        if (!conversation?.id) return
                        toast.info("Generating AI response...")

                        const res = await fetch('/api/ai/generate-reply', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            conversationId: conversation.id
                          })
                        })

                        const data = await res.json()

                        if (!res.ok) {
                          throw new Error(data.error || 'Failed to generate')
                        }

                        if (data.reply) {
                          setMessage(data.reply)
                          toast.success("AI reply generated")
                          textareaRef.current?.focus()
                        }
                      } catch (error) {
                        console.error(error)
                        toast.error("Failed to generate AI reply")
                      }
                    }}
                    disabled={isSending}
                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  >
                    <Sparkles className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate AI reply</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTemplatePickerOpen(true)}
                    disabled={isSending}
                  >
                    <FileText className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send template message</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Textarea
            ref={textareaRef}
            placeholder={attachment ? 'Add a caption...' : 'Type a message... (/ for quick replies)'}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onBlur={handleStopTyping}
            className="min-h-[40px] flex-1 resize-none"
            rows={1}
            disabled={isSending}
          />

          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !attachment) || isSending}
          >
            {isSending || isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {
          isAiEnabled && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Bot className="h-3 w-3" />
              AI auto-responses enabled for this conversation
            </p>
          )
        }
      </div >

      {/* Dialogs */}
      < AssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        conversationId={conversation.id}
        currentAssignee={conversation.assignedTo}
        onAssigned={() => {
          // Optionally refresh conversation data
        }}
      />

      < CampaignPicker
        open={campaignPickerOpen}
        onOpenChange={setCampaignPickerOpen}
        contactId={contact.id}
        onAdded={() => {
          toast.success('Contact added to campaign')
        }}
      />

      < TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleTemplateSelect}
        contact={contact}
        channelId={conversation.channelId}
      />

      <ProductPicker
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onSend={handleProductSend}
      />

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block {contact.name || contact.phoneNumber}?
              They will no longer receive messages from your business and their
              opt-in status will be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBlocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockContact}
              disabled={isBlocking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBlocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blocking...
                </>
              ) : (
                'Block Contact'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  )
}
