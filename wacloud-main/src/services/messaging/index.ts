import prisma from '@/lib/db'
import type { MessageDirection, MessageType, MessageStatus, ConversationStatus, Priority, Prisma } from '@prisma/client'

// ==========================================
// Conversations
// ==========================================

export interface CreateConversationInput {
  contactId: string
  channelId: string
  organizationId: string
  isAiEnabled?: boolean
}

export interface ConversationFilters {
  organizationId: string
  channelId?: string
  status?: ConversationStatus
  assignedTo?: string
  isAiEnabled?: boolean
  hasUnread?: boolean
}

export async function createConversation(data: CreateConversationInput) {
  return prisma.conversation.create({
    data: {
      contactId: data.contactId,
      channelId: data.channelId,
      organizationId: data.organizationId,
      isAiEnabled: data.isAiEnabled || false,
    },
    include: {
      contact: true,
      channel: true,
    },
  })
}

export async function getConversationById(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: true,
      channel: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  })
}

export async function getOrCreateConversation(
  contactId: string,
  channelId: string,
  organizationId: string
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      contactId,
      channelId,
      status: { in: ['OPEN', 'PENDING'] },
    },
    include: {
      contact: true,
      channel: true,
    },
  })

  if (existing) return existing

  return createConversation({ contactId, channelId, organizationId })
}

export async function getConversations(
  filters: ConversationFilters,
  options: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20 } = options

  const where: Prisma.ConversationWhereInput = {
    organizationId: filters.organizationId,
  }

  if (filters.channelId) {
    where.channelId = filters.channelId
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.assignedTo) {
    where.assignedTo = filters.assignedTo
  }

  if (filters.isAiEnabled !== undefined) {
    where.isAiEnabled = filters.isAiEnabled
  }

  if (filters.hasUnread) {
    where.unreadCount = { gt: 0 }
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        channel: true,
      },
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.conversation.count({ where }),
  ])

  return {
    conversations,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function updateConversation(
  id: string,
  data: {
    status?: ConversationStatus
    priority?: Priority
    assignedTo?: string | null
    isAiEnabled?: boolean
    tags?: string[]
  }
) {
  const updateData: Prisma.ConversationUpdateInput = { ...data }

  if (data.status === 'CLOSED' || data.status === 'RESOLVED') {
    updateData.closedAt = new Date()
  }

  return prisma.conversation.update({
    where: { id },
    data: updateData,
    include: {
      contact: true,
      channel: true,
    },
  })
}

export async function markConversationAsRead(id: string) {
  return prisma.conversation.update({
    where: { id },
    data: { unreadCount: 0 },
  })
}

// ==========================================
// Messages
// ==========================================

export interface CreateMessageInput {
  conversationId: string
  direction: MessageDirection
  type: MessageType
  content?: string
  senderId?: string
  senderName?: string
  waMessageId?: string
  mediaUrl?: string
  mediaType?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaCaption?: string
  templateId?: string
  templateName?: string
  templateParams?: Record<string, unknown>
  latitude?: number
  longitude?: number
  locationName?: string
  locationAddress?: string
  isAiGenerated?: boolean
  aiProvider?: string
  aiModel?: string
}

export async function createMessage(data: CreateMessageInput) {
  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId: data.conversationId,
      direction: data.direction,
      type: data.type,
      content: data.content,
      senderId: data.senderId,
      senderName: data.senderName,
      waMessageId: data.waMessageId,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      mediaMimeType: data.mediaMimeType,
      mediaFileName: data.mediaFileName,
      mediaCaption: data.mediaCaption,
      templateId: data.templateId,
      templateName: data.templateName,
      templateParams: data.templateParams as Prisma.InputJsonValue | undefined,
      latitude: data.latitude,
      longitude: data.longitude,
      locationName: data.locationName,
      locationAddress: data.locationAddress,
      isAiGenerated: data.isAiGenerated || false,
      aiProvider: data.aiProvider,
      aiModel: data.aiModel,
      status: data.direction === 'OUTBOUND' ? 'PENDING' : 'DELIVERED',
    },
  })

  // Update conversation
  const preview =
    data.content?.substring(0, 100) ||
    data.mediaCaption?.substring(0, 100) ||
    `[${data.type}]`

  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      unreadCount: data.direction === 'INBOUND' ? { increment: 1 } : undefined,
    },
  })

  // Update contact last contacted
  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    select: { contactId: true },
  })

  if (conversation) {
    await prisma.contact.update({
      where: { id: conversation.contactId },
      data: { lastContactedAt: new Date() },
    })
  }

  return message
}

export async function getMessages(
  conversationId: string,
  options: { page?: number; pageSize?: number; before?: Date } = {}
) {
  const { page = 1, pageSize = 50, before } = options

  const where: Prisma.MessageWhereInput = { conversationId }

  if (before) {
    where.createdAt = { lt: before }
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.message.count({ where: { conversationId } }),
  ])

  return {
    messages: messages.reverse(), // Return in chronological order
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  }
}

export async function updateMessageStatus(
  waMessageId: string,
  status: MessageStatus,
  errorInfo?: { code?: string; message?: string }
) {
  const updateData: Prisma.MessageUpdateInput = {
    status,
    statusUpdatedAt: new Date(),
  }

  if (status === 'SENT') {
    updateData.sentAt = new Date()
  } else if (status === 'DELIVERED') {
    updateData.deliveredAt = new Date()
  } else if (status === 'READ') {
    updateData.readAt = new Date()
  } else if (status === 'FAILED' && errorInfo) {
    updateData.errorCode = errorInfo.code
    updateData.errorMessage = errorInfo.message
  }

  return prisma.message.update({
    where: { waMessageId },
    data: updateData,
  })
}

export async function getMessageByWaId(waMessageId: string) {
  return prisma.message.findUnique({
    where: { waMessageId },
    include: {
      conversation: {
        include: {
          contact: true,
          channel: true,
        },
      },
    },
  })
}

// ==========================================
// Statistics
// ==========================================

export async function getMessagingStats(
  organizationId: string,
  dateRange?: { from: Date; to: Date }
) {
  const where: Prisma.ConversationWhereInput = { organizationId }

  if (dateRange) {
    where.createdAt = {
      gte: dateRange.from,
      lte: dateRange.to,
    }
  }

  const [
    totalConversations,
    openConversations,
    resolvedConversations,
  ] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.count({ where: { ...where, status: 'OPEN' } }),
    prisma.conversation.count({ where: { ...where, status: 'RESOLVED' } }),
  ])

  // Get message stats
  const conversationIds = await prisma.conversation.findMany({
    where,
    select: { id: true },
  })

  const messageWhere: Prisma.MessageWhereInput = {
    conversationId: { in: conversationIds.map((c) => c.id) },
  }

  if (dateRange) {
    messageWhere.createdAt = {
      gte: dateRange.from,
      lte: dateRange.to,
    }
  }

  const [totalMessages, inbound, outbound, aiGenerated] = await Promise.all([
    prisma.message.count({ where: messageWhere }),
    prisma.message.count({ where: { ...messageWhere, direction: 'INBOUND' } }),
    prisma.message.count({ where: { ...messageWhere, direction: 'OUTBOUND' } }),
    prisma.message.count({ where: { ...messageWhere, isAiGenerated: true } }),
  ])

  return {
    conversations: {
      total: totalConversations,
      open: openConversations,
      resolved: resolvedConversations,
    },
    messages: {
      total: totalMessages,
      inbound,
      outbound,
      aiGenerated,
    },
  }
}
