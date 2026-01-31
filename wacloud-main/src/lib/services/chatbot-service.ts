import { prisma } from '@/lib/db'
import { getAIManager, type AIMessage } from '@/lib/ai/provider'
import { FlowExecutor } from './flow-executor'
import { EvolutionApiClient } from '@/lib/evolution-api/client'
import { WhatsAppCloudApiClient } from '@/lib/evolution-api/whatsapp-cloud'
import { Prisma } from '@prisma/client'
import type { Chatbot, Message, Conversation, Contact, Channel } from '@prisma/client'

interface ChatbotContext {
  chatbot: Chatbot
  conversation: Conversation & { contact: Contact; channel: Channel }
  messages: Message[]
}

interface FlowState {
  currentNodeId: string | null
  variables: Record<string, unknown>
  waitingForInput: boolean
  inputType: 'text' | 'buttons' | 'list' | null
  expectedOptions?: string[]
  lastExecutedAt: string
}

interface FlowData {
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
  }>
}

export class ChatbotService {
  /**
   * Process an incoming message and generate AI response if chatbot is enabled
   */
  async processIncomingMessage(
    conversationId: string,
    incomingMessage: Message
  ): Promise<Message | null> {
    try {
      // Get conversation with contact and channel
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          contact: true,
          channel: true,
        },
      })

      if (!conversation) {
        console.error('[Chatbot] Conversation not found:', conversationId)
        return null
      }

      // Check if AI is enabled for this conversation
      if (!conversation.isAiEnabled) {
        return null
      }

      // Find chatbot - use aiSessionId if specified, otherwise find first active
      let chatbot = null

      if (conversation.aiSessionId) {
        // Use specifically selected chatbot (from playground or manual selection)
        chatbot = await prisma.chatbot.findUnique({
          where: { id: conversation.aiSessionId },
        })
      }

      if (!chatbot) {
        // Fallback to first active chatbot for this organization
        chatbot = await prisma.chatbot.findFirst({
          where: {
            organizationId: conversation.organizationId,
            isActive: true,
          },
        })
      }

      if (!chatbot) {
        console.log('[Chatbot] No chatbot found for conversation')
        return null
      }

      console.log(`[Chatbot] Using chatbot: ${chatbot.name} (${chatbot.id}) - Type: ${chatbot.flowType}`)

      // Route based on flow type
      switch (chatbot.flowType) {
        case 'FLOW':
          return await this.processFlowMessage(chatbot, conversation, incomingMessage)

        case 'HYBRID':
          return await this.processHybridMessage(chatbot, conversation, incomingMessage)

        case 'AI':
        default:
          return await this.processAIMessage(chatbot, conversation, incomingMessage)
      }
    } catch (error) {
      console.error('[Chatbot] Error processing message:', error)
      return null
    }
  }

  /**
   * Process message using FLOW-based chatbot
   */
  private async processFlowMessage(
    chatbot: Chatbot,
    conversation: Conversation & { contact: Contact; channel: Channel },
    incomingMessage: Message
  ): Promise<Message | null> {
    const flowData = chatbot.flowData as unknown as FlowData | null

    if (!flowData || !flowData.nodes || flowData.nodes.length === 0) {
      console.log('[Chatbot] No flow data found, skipping')
      return null
    }

    // Get or initialize flow state
    const flowState: FlowState = (conversation.flowState as unknown as FlowState) || {
      currentNodeId: null,
      variables: {},
      waitingForInput: false,
      inputType: null,
      lastExecutedAt: new Date().toISOString(),
    }

    // Create flow executor
    const executor = new FlowExecutor({
      chatbot,
      conversation,
      flowData,
      flowState,
      incomingMessage,
    })

    // Execute flow
    const result = await executor.execute()

    // Save updated flow state
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        flowState: result.newState as object,
        isAiEnabled: !result.handoff, // Disable if handoff
      },
    })

    // Send responses
    let lastMessage: Message | null = null

    for (const responseText of result.responses) {
      lastMessage = await this.sendResponse(conversation, responseText, chatbot)
    }

    // Send media messages
    for (const media of result.mediaMessages) {
      lastMessage = await this.sendMediaResponse(conversation, media, chatbot)
    }

    // Send template messages
    for (const template of result.templateMessages) {
      lastMessage = await this.sendTemplateResponse(conversation, template, chatbot)
    }

    return lastMessage
  }

  /**
   * Process message using HYBRID chatbot (flow + AI fallback)
   */
  private async processHybridMessage(
    chatbot: Chatbot,
    conversation: Conversation & { contact: Contact; channel: Channel },
    incomingMessage: Message
  ): Promise<Message | null> {
    const flowData = chatbot.flowData as unknown as FlowData | null
    const flowState = (conversation.flowState as unknown as FlowState) || null

    // If we have active flow state (in the middle of a flow), continue with flow
    if (flowState?.currentNodeId || flowState?.waitingForInput) {
      console.log('[Chatbot] Continuing hybrid flow')
      return await this.processFlowMessage(chatbot, conversation, incomingMessage)
    }

    // Check if message matches any trigger keywords to start flow
    const messageContent = incomingMessage.content?.toLowerCase() || ''
    const triggerKeywords = chatbot.triggerKeywords || []

    const shouldStartFlow =
      flowData &&
      flowData.nodes.length > 0 &&
      triggerKeywords.some((keyword) => messageContent.includes(keyword.toLowerCase()))

    if (shouldStartFlow) {
      console.log('[Chatbot] Starting hybrid flow based on trigger')
      return await this.processFlowMessage(chatbot, conversation, incomingMessage)
    }

    // No flow match - use AI
    console.log('[Chatbot] Using AI for hybrid chatbot')
    return await this.processAIMessage(chatbot, conversation, incomingMessage)
  }

  /**
   * Process message using AI-powered chatbot
   */
  private async processAIMessage(
    chatbot: Chatbot,
    conversation: Conversation & { contact: Contact; channel: Channel },
    incomingMessage: Message
  ): Promise<Message | null> {
    // Check for handoff keywords
    const messageContent = incomingMessage.content?.toLowerCase() || ''
    const handoffKeywords = chatbot.handoffKeywords || []

    if (handoffKeywords.some((keyword) => messageContent.includes(keyword.toLowerCase()))) {
      // Disable AI and notify
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { isAiEnabled: false },
      })

      if (chatbot.handoffMessage) {
        return await this.sendResponse(conversation, chatbot.handoffMessage, chatbot)
      }
      return null
    }

    // Check business hours if enabled
    if (chatbot.respectBusinessHours && chatbot.businessHours) {
      const isWithinHours = this.isWithinBusinessHours(
        chatbot.businessHours as Record<string, unknown>
      )
      if (!isWithinHours && chatbot.outOfHoursMessage) {
        return await this.sendResponse(conversation, chatbot.outOfHoursMessage, chatbot)
      }
    }

    // Get conversation history for context
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Generate AI response
    const context: ChatbotContext = {
      chatbot,
      conversation,
      messages: recentMessages.reverse(),
    }

    const aiResponse = await this.generateAIResponse(context, incomingMessage)

    if (aiResponse) {
      return await this.sendResponse(conversation, aiResponse, chatbot)
    }

    return null
  }

  /**
   * Generate AI response using configured provider
   */
  private async generateAIResponse(
    context: ChatbotContext,
    incomingMessage: Message
  ): Promise<string | null> {
    const { chatbot, conversation, messages } = context

    try {
      const aiManager = getAIManager()

      // Build conversation history
      const aiMessages: AIMessage[] = []

      // Add system prompt
      const systemPrompt = this.buildSystemPrompt(chatbot, conversation.contact)
      aiMessages.push({ role: 'system', content: systemPrompt })

      // Add conversation history
      for (const msg of messages) {
        if (msg.type === 'TEXT' && msg.content) {
          aiMessages.push({
            role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
            content: msg.content,
          })
        }
      }

      // Add current message
      if (incomingMessage.content) {
        aiMessages.push({ role: 'user', content: incomingMessage.content })
      }

      // Call AI with usage tracking
      const provider = chatbot.aiProvider as 'openai' | 'anthropic'
      const response = await aiManager.chat(aiMessages, {
        provider,
        model: chatbot.aiModel,
        temperature: chatbot.temperature,
        maxTokens: chatbot.maxTokens,
      }, {
        organizationId: conversation.organizationId,
        feature: 'chat-response',
      })

      return response.content
    } catch (error) {
      console.error('[Chatbot] Error generating AI response:', error)
      return null
    }
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(chatbot: Chatbot, contact: Contact): string {
    let prompt = chatbot.systemPrompt || 'You are a helpful customer service assistant.'

    // Add contact context
    prompt += `\n\nCustomer Information:`
    if (contact.name) prompt += `\n- Name: ${contact.name}`
    if (contact.email) prompt += `\n- Email: ${contact.email}`
    if (contact.phoneNumber) prompt += `\n- Phone: ${contact.phoneNumber}`

    // Add knowledge base if available
    if (chatbot.knowledgeBase) {
      const kb = chatbot.knowledgeBase as { content?: string }
      if (kb.content) {
        prompt += `\n\nKnowledge Base:\n${kb.content}`
      }
    }

    prompt += `\n\nInstructions:
- Be helpful, professional, and concise
- If you don't know something, admit it
- Keep responses under 500 characters when possible
- Use simple language`

    return prompt
  }

  /**
   * Send text response via WhatsApp
   */
  private async sendResponse(
    conversation: Conversation & { contact: Contact; channel: Channel },
    responseText: string,
    chatbot: Chatbot
  ): Promise<Message> {
    const { channel, contact } = conversation

    // Create message in database
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: responseText,
        status: 'PENDING',
        isAiGenerated: true,
        aiProvider: chatbot.aiProvider,
        aiModel: chatbot.aiModel,
      },
    })

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: responseText.slice(0, 100),
      },
    })

    // Send via WhatsApp
    await this.sendViaWhatsApp(channel, contact, message, 'text', { text: responseText })

    return message
  }

  /**
   * Send media response via WhatsApp
   */
  private async sendMediaResponse(
    conversation: Conversation & { contact: Contact; channel: Channel },
    media: { type: string; url: string; caption?: string },
    chatbot: Chatbot
  ): Promise<Message> {
    const { channel, contact } = conversation

    const messageType = media.type.toUpperCase() as 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'

    // Create message in database
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: messageType,
        content: media.caption || null,
        mediaUrl: media.url,
        mediaType: media.type,
        status: 'PENDING',
        isAiGenerated: true,
      },
    })

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: `[${media.type}]`,
      },
    })

    // Send via WhatsApp
    await this.sendViaWhatsApp(channel, contact, message, 'media', {
      type: media.type,
      url: media.url,
      caption: media.caption,
    })

    return message
  }

  /**
   * Send template response via WhatsApp
   */
  private async sendTemplateResponse(
    conversation: Conversation & { contact: Contact; channel: Channel },
    template: { templateId: string; params: Record<string, string> },
    chatbot: Chatbot
  ): Promise<Message> {
    const { channel, contact } = conversation

    // Get template details
    const templateRecord = await prisma.messageTemplate.findUnique({
      where: { id: template.templateId },
    })

    // Create message in database
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        templateId: template.templateId,
        templateName: templateRecord?.name || 'Unknown',
        templateParams: template.params,
        status: 'PENDING',
        isAiGenerated: true,
      },
    })

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: `[Template: ${templateRecord?.name || 'Unknown'}]`,
      },
    })

    // Send via WhatsApp (template sending would need template-specific logic)
    console.log('[Chatbot] Template message created:', message.id)

    return message
  }

  /**
   * Send message via WhatsApp
   */
  private async sendViaWhatsApp(
    channel: Channel,
    contact: Contact,
    message: Message,
    type: 'text' | 'media',
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      if (channel.connectionType === 'EVOLUTION_API' && channel.evolutionInstance) {
        const evolutionClient = new EvolutionApiClient({
          baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
          apiKey: channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
        })

        const phoneNumber = contact.phoneNumber.replace(/\D/g, '')

        let result
        if (type === 'text') {
          result = await evolutionClient.sendText(channel.evolutionInstance, {
            number: phoneNumber,
            text: payload.text as string,
          })
        } else if (type === 'media') {
          const mediaType = payload.type as 'image' | 'video' | 'audio' | 'document'
          // Determine mimetype based on media type
          const mimetypeMap: Record<string, string> = {
            image: 'image/jpeg',
            video: 'video/mp4',
            audio: 'audio/mpeg',
            document: 'application/pdf',
          }
          result = await evolutionClient.sendMedia(channel.evolutionInstance, {
            number: phoneNumber,
            mediatype: mediaType,
            mimetype: (payload.mimetype as string) || mimetypeMap[mediaType] || 'application/octet-stream',
            media: payload.url as string,
            caption: payload.caption as string | undefined,
          })
        }

        // Update message with WhatsApp ID
        if (result?.key?.id) {
          await prisma.message.update({
            where: { id: message.id },
            data: {
              waMessageId: result.key.id,
              status: 'SENT',
              sentAt: new Date(),
            },
          })
        }
      } else if (channel.connectionType === 'CLOUD_API' && channel.phoneNumberId) {
        // Send via WhatsApp Cloud API
        const settings = channel.settings as { accessToken?: string } | null
        const accessToken = settings?.accessToken || process.env.META_ACCESS_TOKEN

        if (accessToken) {
          const cloudClient = new WhatsAppCloudApiClient({
            accessToken,
            phoneNumberId: channel.phoneNumberId,
            businessAccountId: channel.wabaId || undefined,
          })

          const phoneNumber = contact.phoneNumber.replace(/\D/g, '')
          let waMessageId: string | null = null

          if (type === 'text') {
            const response = await cloudClient.sendText({
              to: phoneNumber,
              text: { body: payload.text as string },
            })
            waMessageId = response.messages?.[0]?.id || null
          } else if (type === 'media') {
            // Handle media sending via Cloud API
            // Simplified mapping for now
            const mediaType = payload.type as 'image' | 'video' | 'audio' | 'document'
            if (mediaType === 'image') {
              const response = await cloudClient.sendMedia({
                to: phoneNumber,
                type: 'image',
                image: { link: payload.url as string, caption: payload.caption as string },
              })
              waMessageId = response.messages?.[0]?.id || null
            }
            // Add other types as needed
          }

          if (waMessageId) {
            await prisma.message.update({
              where: { id: message.id },
              data: {
                waMessageId,
                status: 'SENT',
                sentAt: new Date(),
              },
            })
          }
        }
      }
    } catch (sendError) {
      console.error('[Chatbot] Error sending response:', sendError)
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          errorMessage: sendError instanceof Error ? sendError.message : 'Send failed',
        },
      })
    }
  }

  /**
   * Check if current time is within business hours
   */
  private isWithinBusinessHours(businessHours: Record<string, unknown>): boolean {
    const now = new Date()
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute

    const daySchedule = businessHours[dayOfWeek] as
      | { start?: string; end?: string; closed?: boolean }
      | undefined

    if (!daySchedule || daySchedule.closed) {
      return false
    }

    if (daySchedule.start && daySchedule.end) {
      const [startHour, startMin] = daySchedule.start.split(':').map(Number)
      const [endHour, endMin] = daySchedule.end.split(':').map(Number)
      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin

      return currentTime >= startTime && currentTime <= endTime
    }

    return true
  }

  /**
   * Enable AI for a conversation
   */
  async enableAI(conversationId: string, chatbotId?: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isAiEnabled: true,
        aiSessionId: chatbotId || null,
        flowState: Prisma.DbNull, // Reset flow state
      },
    })
  }

  /**
   * Disable AI for a conversation
   */
  async disableAI(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isAiEnabled: false,
        flowState: Prisma.DbNull, // Reset flow state
      },
    })
  }

  /**
   * Reset flow state for a conversation
   */
  async resetFlowState(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        flowState: Prisma.DbNull,
      },
    })
  }
}

// Singleton instance
let chatbotService: ChatbotService | null = null

export function getChatbotService(): ChatbotService {
  if (!chatbotService) {
    chatbotService = new ChatbotService()
  }
  return chatbotService
}
