// Core types for the WhatsApp CRM application

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
export type Plan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  organizationId: string
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Organization {
  id: string
  name: string
  slug: string
  schemaName: string
  plan: Plan
  billingEmail: string | null
  maxUsers: number
  maxChannels: number
  maxContacts: number
  maxMessages: number
  createdAt: Date
  updatedAt: Date
}

// Channel types
export type ConnectionType = 'CLOUD_API' | 'EVOLUTION_API'
export type ChannelStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING' | 'ERROR'

export interface Channel {
  id: string
  name: string
  phoneNumber: string
  phoneNumberId: string | null
  wabaId: string | null
  evolutionInstance: string | null
  connectionType: ConnectionType
  status: ChannelStatus
  createdAt: Date
  updatedAt: Date
}

// Contact types
export type ContactStage = 'NEW' | 'LEAD' | 'QUALIFIED' | 'CUSTOMER' | 'CHURNED'

export interface Contact {
  id: string
  phoneNumber: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  waId: string | null
  profileName: string | null
  tags: string[]
  customFields: Record<string, unknown> | null
  notes: string | null
  segment: string | null
  leadScore: number
  stage: ContactStage
  isOptedIn: boolean
  assignedTo: string | null
  channelId: string
  createdAt: Date
  updatedAt: Date
  lastContactedAt: Date | null
  channel?: Channel
}

// Conversation types
export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface Conversation {
  id: string
  contactId: string
  channelId: string
  status: ConversationStatus
  priority: Priority
  assignedTo: string | null
  unreadCount: number
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  isAiEnabled: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
  contact?: Contact
  channel?: Channel
  messages?: Message[]
}

// Message types
export type MessageDirection = 'INBOUND' | 'OUTBOUND'
export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'STICKER'
  | 'LOCATION'
  | 'CONTACT'
  | 'TEMPLATE'
  | 'INTERACTIVE'
  | 'REACTION'
  | 'UNKNOWN'
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

export interface Message {
  id: string
  conversationId: string
  waMessageId: string | null
  direction: MessageDirection
  senderId: string | null
  senderName: string | null
  type: MessageType
  content: string | null
  mediaUrl: string | null
  mediaType: string | null
  mediaMimeType: string | null
  mediaFileName: string | null
  mediaCaption: string | null
  templateId: string | null
  templateName: string | null
  templateParams: Record<string, unknown> | null
  interactiveType: string | null
  interactiveData: Record<string, unknown> | null
  latitude: number | null
  longitude: number | null
  locationName: string | null
  locationAddress: string | null
  reaction: string | null
  reactedTo: string | null
  status: MessageStatus
  statusUpdatedAt: Date | null
  errorCode: string | null
  errorMessage: string | null
  isAiGenerated: boolean
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  createdAt: Date
}

// Campaign types
export type CampaignType = 'BROADCAST' | 'DRIP' | 'TRIGGERED'
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'

export interface Campaign {
  id: string
  name: string
  description: string | null
  type: CampaignType
  status: CampaignStatus
  targetSegment: string | null
  targetTags: string[]
  targetFilters: Record<string, unknown> | null
  messageType: MessageType
  messageContent: string | null
  templateId: string | null
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  replyCount: number
  channelId: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
  channel?: { id: string; name: string; phoneNumber: string }
  mediaUrl?: string | null
  templateParams?: Record<string, unknown> | null
  messagesPerSecond?: number
}

// Chatbot types
export type ChatbotFlowType = 'AI' | 'FLOW' | 'HYBRID'

export interface Chatbot {
  id: string
  name: string
  description: string | null
  isActive: boolean
  aiProvider: string
  aiModel: string
  systemPrompt: string | null
  temperature: number
  maxTokens: number
  flowType: ChatbotFlowType
  flowData: Record<string, unknown> | null
  triggerKeywords: string[]
  triggerOnNewConversation: boolean
  handoffKeywords: string[]
  handoffMessage: string | null
  createdAt: Date
  updatedAt: Date
}

// Template types
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
export type TemplateComponentType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export interface MessageTemplate {
  id: string
  name: string
  language: string
  category: TemplateCategory
  headerType: TemplateComponentType | null
  headerContent: string | null
  headerMediaUrl: string | null
  bodyText: string
  bodyVariables: string[]
  footerText: string | null
  buttons: Record<string, unknown> | null
  waTemplateId: string | null
  status: TemplateStatus
  rejectionReason: string | null
  channelId: string
  createdAt: Date
  updatedAt: Date
}



// CRM types
export interface Pipeline {
  id: string
  name: string
  stages: Array<{
    id: string
    name: string
    order: number
    color?: string
    probability?: number
  }>
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Deal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: Date | null
  closedAt: Date | null
  closedReason: string | null
  contactId: string
  pipelineId?: string
  assignedTo: string | null
  createdAt: Date
  updatedAt: Date
  contact?: Contact
  activities?: Activity[]
}

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE' | 'WHATSAPP'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string | null
  dueDate: Date | null
  completedAt: Date | null
  contactId: string | null
  dealId: string | null
  assignedTo: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  creator?: User
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Evolution API types
export interface EvolutionInstance {
  instanceName: string
  instanceId: string
  status: 'open' | 'close' | 'connecting'
  owner: string
  profileName?: string
  profilePictureUrl?: string
}

export interface EvolutionMessage {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: {
    conversation?: string
    extendedTextMessage?: {
      text: string
    }
    imageMessage?: {
      url: string
      mimetype: string
      caption?: string
    }
    videoMessage?: {
      url: string
      mimetype: string
      caption?: string
    }
    audioMessage?: {
      url: string
      mimetype: string
    }
    documentMessage?: {
      url: string
      mimetype: string
      fileName: string
    }
  }
  messageTimestamp: number
  status: 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED'
}

// WhatsApp Cloud API types
export interface WhatsAppCloudMessage {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' | 'interactive'
  text?: {
    preview_url?: boolean
    body: string
  }
  image?: {
    id?: string
    link?: string
    caption?: string
  }
  video?: {
    id?: string
    link?: string
    caption?: string
  }
  audio?: {
    id?: string
    link?: string
  }
  document?: {
    id?: string
    link?: string
    caption?: string
    filename?: string
  }
  template?: {
    name: string
    language: {
      code: string
    }
    components?: Array<{
      type: 'header' | 'body' | 'button'
      parameters: Array<{
        type: 'text' | 'image' | 'video' | 'document'
        text?: string
        image?: { link: string }
        video?: { link: string }
        document?: { link: string }
      }>
    }>
  }
  interactive?: {
    type: 'button' | 'list' | 'product' | 'product_list'
    header?: {
      type: 'text' | 'image' | 'video' | 'document'
      text?: string
    }
    body: {
      text: string
    }
    footer?: {
      text: string
    }
    action: Record<string, unknown>
  }
}
