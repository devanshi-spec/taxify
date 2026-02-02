import axios, { AxiosInstance } from 'axios'

export interface EvolutionConfig {
  baseUrl: string
  apiKey: string
}

export interface InstanceInfo {
  instanceName: string
  instanceId: string
  status: 'open' | 'close' | 'connecting'
  owner: string
  profileName?: string
  profilePictureUrl?: string
  integration: string
}

export interface QRCodeResponse {
  pairingCode?: string
  code?: string
  base64?: string
  count: number
}

export interface SendTextMessage {
  number: string
  text: string
  delay?: number
  linkPreview?: boolean
}

export interface SendMediaMessage {
  number: string
  mediatype: 'image' | 'video' | 'audio' | 'document'
  mimetype: string
  caption?: string
  fileName?: string
  media: string // base64 or URL
  delay?: number
}

export interface SendTemplateMessage {
  number: string
  name: string
  language: string
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

export interface MessageResponse {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: Record<string, unknown>
  messageTimestamp: number
  status: string
}

export interface WebhookConfig {
  url: string
  webhookByEvents: boolean
  webhookBase64: boolean
  events: string[]
}

export interface ContactInfo {
  id: string
  pushName?: string
  profilePictureUrl?: string
  status?: string
}

/**
 * Evolution API Client
 * Documentation: https://doc.evolution-api.com/
 */
export class EvolutionApiClient {
  private client: AxiosInstance

  constructor(config: EvolutionConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
      },
    })
  }

  // ==========================================
  // Instance Management
  // ==========================================

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(instanceName: string, options?: {
    integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS'
    qrcode?: boolean
    number?: string
    token?: string
    webhook?: WebhookConfig
  }): Promise<{ instance: InstanceInfo; hash: string; qrcode?: QRCodeResponse }> {
    const response = await this.client.post('/instance/create', {
      instanceName,
      integration: options?.integration || 'WHATSAPP-BAILEYS',
      qrcode: options?.qrcode ?? true,
      number: options?.number,
      token: options?.token,
      webhook: options?.webhook,
    })
    return response.data
  }

  /**
   * Get instance info
   */
  async getInstance(instanceName: string): Promise<InstanceInfo> {
    const response = await this.client.get(`/instance/fetchInstances`, {
      params: { instanceName },
    })
    return response.data[0]
  }

  /**
   * Get all instances
   */
  async getAllInstances(): Promise<InstanceInfo[]> {
    const response = await this.client.get('/instance/fetchInstances')
    return response.data
  }

  /**
   * Connect to WhatsApp (get QR code)
   */
  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    const response = await this.client.get(`/instance/connect/${instanceName}`)
    return response.data
  }

  /**
   * Get connection state
   */
  async getConnectionState(instanceName: string): Promise<{ state: string }> {
    const response = await this.client.get(`/instance/connectionState/${instanceName}`)
    return response.data
  }

  /**
   * Logout from WhatsApp
   */
  async logoutInstance(instanceName: string): Promise<void> {
    await this.client.delete(`/instance/logout/${instanceName}`)
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceName: string): Promise<void> {
    await this.client.delete(`/instance/delete/${instanceName}`)
  }

  /**
   * Restart an instance
   */
  async restartInstance(instanceName: string): Promise<void> {
    await this.client.put(`/instance/restart/${instanceName}`)
  }

  // ==========================================
  // Messaging
  // ==========================================

  /**
   * Send a text message
   */
  async sendText(instanceName: string, message: SendTextMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendText/${instanceName}`, message)
    return response.data
  }

  /**
   * Send a media message (image, video, audio, document)
   */
  async sendMedia(instanceName: string, message: SendMediaMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendMedia/${instanceName}`, message)
    return response.data
  }

  /**
   * Send a WhatsApp template message
   */
  async sendTemplate(instanceName: string, message: SendTemplateMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendTemplate/${instanceName}`, message)
    return response.data
  }

  /**
   * Send location
   */
  async sendLocation(
    instanceName: string,
    data: {
      number: string
      name: string
      address: string
      latitude: number
      longitude: number
      delay?: number
    }
  ): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendLocation/${instanceName}`, data)
    return response.data
  }

  /**
   * Send contact card
   */
  async sendContact(
    instanceName: string,
    data: {
      number: string
      contact: Array<{
        fullName: string
        wuid: string
        phoneNumber: string
        organization?: string
        email?: string
        url?: string
      }>
    }
  ): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendContact/${instanceName}`, data)
    return response.data
  }

  /**
   * Send reaction to a message
   */
  async sendReaction(
    instanceName: string,
    data: {
      key: {
        remoteJid: string
        fromMe: boolean
        id: string
      }
      reaction: string
    }
  ): Promise<void> {
    await this.client.post(`/message/sendReaction/${instanceName}`, data)
  }

  /**
   * Send list message (interactive)
   */
  async sendList(
    instanceName: string,
    data: {
      number: string
      title: string
      description: string
      buttonText: string
      footerText?: string
      sections: Array<{
        title: string
        rows: Array<{
          title: string
          description?: string
          rowId: string
        }>
      }>
      delay?: number
    }
  ): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendList/${instanceName}`, data)
    return response.data
  }

  /**
   * Send buttons message (interactive)
   */
  async sendButtons(
    instanceName: string,
    data: {
      number: string
      title: string
      description: string
      footer?: string
      buttons: Array<{
        type: 'reply' | 'copy' | 'url' | 'call'
        displayText: string
        id?: string
        copyCode?: string
        url?: string
        phoneNumber?: string
      }>
      delay?: number
    }
  ): Promise<MessageResponse> {
    const response = await this.client.post(`/message/sendButtons/${instanceName}`, data)
    return response.data
  }

  // ==========================================
  // Contact Management
  // ==========================================

  /**
   * Check if a number is registered on WhatsApp
   */
  async checkNumber(instanceName: string, numbers: string[]): Promise<Array<{
    exists: boolean
    jid: string
    number: string
  }>> {
    const response = await this.client.post(`/chat/whatsappNumbers/${instanceName}`, { numbers })
    return response.data
  }

  /**
   * Get contact info
   */
  async getContact(instanceName: string, number: string): Promise<ContactInfo> {
    const response = await this.client.post(`/chat/fetchProfile/${instanceName}`, { number })
    return response.data
  }

  /**
   * Get profile picture URL
   */
  async getProfilePicture(instanceName: string, number: string): Promise<{ profilePictureUrl: string }> {
    const response = await this.client.post(`/chat/fetchProfilePictureUrl/${instanceName}`, { number })
    return response.data
  }

  // ==========================================
  // Chat Management
  // ==========================================

  /**
   * Mark messages as read
   */
  async markAsRead(
    instanceName: string,
    data: {
      readMessages: Array<{
        remoteJid: string
        fromMe: boolean
        id: string
      }>
    }
  ): Promise<void> {
    await this.client.post(`/chat/markMessageAsRead/${instanceName}`, data)
  }

  /**
   * Archive/unarchive chat
   */
  async archiveChat(
    instanceName: string,
    data: {
      chat: string
      archive: boolean
    }
  ): Promise<void> {
    await this.client.post(`/chat/archiveChat/${instanceName}`, data)
  }

  /**
   * Delete message for everyone
   */
  async deleteMessage(
    instanceName: string,
    data: {
      remoteJid: string
      fromMe: boolean
      id: string
      participant?: string
    }
  ): Promise<void> {
    await this.client.delete(`/chat/deleteMessageForEveryone/${instanceName}`, { data })
  }

  /**
   * Get chat messages
   */
  async getMessages(
    instanceName: string,
    data: {
      where: {
        key: {
          remoteJid: string
        }
      }
      limit?: number
    }
  ): Promise<MessageResponse[]> {
    const response = await this.client.post(`/chat/findMessages/${instanceName}`, data)
    return response.data
  }

  // ==========================================
  // Webhook Configuration
  // ==========================================

  /**
   * Set webhook URL
   */
  async setWebhook(instanceName: string, config: WebhookConfig): Promise<void> {
    await this.client.post(`/webhook/set/${instanceName}`, config)
  }

  /**
   * Get webhook configuration
   */
  async getWebhook(instanceName: string): Promise<WebhookConfig> {
    const response = await this.client.get(`/webhook/find/${instanceName}`)
    return response.data
  }

  // ==========================================
  // Profile Management
  // ==========================================

  /**
   * Update profile name
   */
  async updateProfileName(instanceName: string, name: string): Promise<void> {
    await this.client.post(`/chat/updateProfileName/${instanceName}`, { name })
  }

  /**
   * Update profile status
   */
  async updateProfileStatus(instanceName: string, status: string): Promise<void> {
    await this.client.post(`/chat/updateProfileStatus/${instanceName}`, { status })
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(instanceName: string, picture: string): Promise<void> {
    await this.client.post(`/chat/updateProfilePicture/${instanceName}`, { picture })
  }
}

// Default client instance
let evolutionClient: EvolutionApiClient | null = null

export function getEvolutionClient(): EvolutionApiClient {
  if (!evolutionClient) {
    evolutionClient = new EvolutionApiClient({
      baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: process.env.EVOLUTION_API_KEY || '',
    })
  }
  return evolutionClient
}
