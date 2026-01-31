import axios, { AxiosInstance } from 'axios'

/**
 * WhatsApp Cloud API Client (Meta's Official API)
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export interface CloudApiConfig {
  accessToken: string
  phoneNumberId: string
  businessAccountId?: string
  version?: string
}

export interface TextMessage {
  to: string
  text: {
    preview_url?: boolean
    body: string
  }
}

export interface MediaMessage {
  to: string
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker'
  image?: { id?: string; link?: string; caption?: string }
  video?: { id?: string; link?: string; caption?: string }
  audio?: { id?: string; link?: string }
  document?: { id?: string; link?: string; caption?: string; filename?: string }
  sticker?: { id?: string; link?: string }
}

export interface TemplateMessage {
  to: string
  template: {
    name: string
    language: { code: string }
    components?: Array<{
      type: 'header' | 'body' | 'button'
      sub_type?: 'quick_reply' | 'url'
      index?: number
      parameters: Array<{
        type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document' | 'payload'
        text?: string
        currency?: { fallback_value: string; code: string; amount_1000: number }
        date_time?: { fallback_value: string }
        image?: { link: string }
        video?: { link: string }
        document?: { link: string; filename?: string }
        payload?: string
      }>
    }>
  }
}

export interface InteractiveMessage {
  to: string
  interactive: {
    type: 'button' | 'list' | 'product' | 'product_list' | 'flow'
    header?: {
      type: 'text' | 'image' | 'video' | 'document'
      text?: string
      image?: { id?: string; link?: string }
      video?: { id?: string; link?: string }
      document?: { id?: string; link?: string; filename?: string }
    }
    body: { text: string }
    footer?: { text: string }
    action: {
      button?: string
      buttons?: Array<{
        type: 'reply'
        reply: { id: string; title: string }
      }>
      sections?: Array<{
        title?: string
        rows: Array<{
          id: string
          title: string
          description?: string
        }>
      }>
      catalog_id?: string
      product_retailer_id?: string
    }
  }
}

export interface LocationMessage {
  to: string
  location: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
}

export interface ContactMessage {
  to: string
  contacts: Array<{
    addresses?: Array<{
      city?: string
      country?: string
      country_code?: string
      state?: string
      street?: string
      type?: 'HOME' | 'WORK'
      zip?: string
    }>
    birthday?: string
    emails?: Array<{ email?: string; type?: 'HOME' | 'WORK' }>
    name: {
      formatted_name: string
      first_name?: string
      last_name?: string
      middle_name?: string
      suffix?: string
      prefix?: string
    }
    org?: { company?: string; department?: string; title?: string }
    phones?: Array<{ phone?: string; type?: 'CELL' | 'MAIN' | 'IPHONE' | 'HOME' | 'WORK'; wa_id?: string }>
    urls?: Array<{ url?: string; type?: 'HOME' | 'WORK' }>
  }>
}

export interface MessageResponse {
  messaging_product: 'whatsapp'
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

export interface MediaUploadResponse {
  id: string
}

export interface MediaResponse {
  url: string
  mime_type: string
  sha256: string
  file_size: number
  id: string
  messaging_product: 'whatsapp'
}

export interface BusinessProfile {
  about?: string
  address?: string
  description?: string
  email?: string
  profile_picture_url?: string
  websites?: string[]
  vertical?: string
}

export interface TemplateResponse {
  id: string
  status: 'APPROVED' | 'IN_APPEAL' | 'PENDING' | 'REJECTED' | 'PENDING_DELETION' | 'DELETED' | 'DISABLED' | 'PAUSED' | 'LIMIT_EXCEEDED'
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY'
  language: string
  name: string
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
    text?: string
    example?: { header_text?: string[]; body_text?: string[][] }
    buttons?: Array<{
      type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY' | 'COPY_CODE'
      text: string
      url?: string
      phone_number?: string
      example?: string[]
    }>
  }>
}

export class WhatsAppCloudApiClient {
  private client: AxiosInstance
  private phoneNumberId: string
  private businessAccountId?: string

  constructor(config: CloudApiConfig) {
    const version = config.version || 'v18.0'
    this.phoneNumberId = config.phoneNumberId
    this.businessAccountId = config.businessAccountId

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${version}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
    })
  }

  // ==========================================
  // Messaging
  // ==========================================

  /**
   * Send a text message
   */
  async sendText(message: TextMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'text',
      text: message.text,
    })
    return response.data
  }

  /**
   * Send a media message
   */
  async sendMedia(message: MediaMessage): Promise<MessageResponse> {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: message.type,
    }

    payload[message.type] = message[message.type]

    const response = await this.client.post(`/${this.phoneNumberId}/messages`, payload)
    return response.data
  }

  /**
   * Send a template message
   */
  async sendTemplate(message: TemplateMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'template',
      template: message.template,
    })
    return response.data
  }

  /**
   * Send an interactive message (buttons, list)
   */
  async sendInteractive(message: InteractiveMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'interactive',
      interactive: message.interactive,
    })
    return response.data
  }

  /**
   * Send a location message
   */
  async sendLocation(message: LocationMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'location',
      location: message.location,
    })
    return response.data
  }

  /**
   * Send a contact card
   */
  async sendContact(message: ContactMessage): Promise<MessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'contacts',
      contacts: message.contacts,
    })
    return response.data
  }

  /**
   * Send a reaction
   */
  async sendReaction(to: string, messageId: string, emoji: string): Promise<MessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji,
      },
    })
    return response.data
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    })
    return response.data
  }

  // ==========================================
  // Media Management
  // ==========================================

  /**
   * Upload media
   */
  async uploadMedia(file: Buffer, mimeType: string, filename: string): Promise<MediaUploadResponse> {
    const FormData = (await import('form-data')).default
    const formData = new FormData()
    formData.append('file', file, { filename, contentType: mimeType })
    formData.append('messaging_product', 'whatsapp')
    formData.append('type', mimeType)

    const response = await this.client.post(`/${this.phoneNumberId}/media`, formData, {
      headers: formData.getHeaders(),
    })
    return response.data
  }

  /**
   * Get media URL
   */
  async getMediaUrl(mediaId: string): Promise<MediaResponse> {
    const response = await this.client.get(`/${mediaId}`)
    return response.data
  }

  /**
   * Download media
   */
  async downloadMedia(url: string): Promise<Buffer> {
    const response = await this.client.get(url, { responseType: 'arraybuffer' })
    return Buffer.from(response.data)
  }

  /**
   * Delete media
   */
  async deleteMedia(mediaId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/${mediaId}`)
    return response.data
  }

  // ==========================================
  // Templates
  // ==========================================

  /**
   * Get message templates
   */
  async getTemplates(limit = 100): Promise<{ data: TemplateResponse[] }> {
    if (!this.businessAccountId) {
      throw new Error('Business account ID is required for template operations')
    }
    const response = await this.client.get(`/${this.businessAccountId}/message_templates`, {
      params: { limit },
    })
    return response.data
  }

  /**
   * Create a message template
   */
  async createTemplate(template: {
    name: string
    category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY'
    language: string
    components: Array<{
      type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
      format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
      text?: string
      example?: { header_text?: string[]; body_text?: string[][] }
      buttons?: Array<{
        type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY'
        text: string
        url?: string
        phone_number?: string
      }>
    }>
  }): Promise<{ id: string; status: string }> {
    if (!this.businessAccountId) {
      throw new Error('Business account ID is required for template operations')
    }
    const response = await this.client.post(`/${this.businessAccountId}/message_templates`, template)
    return response.data
  }

  /**
   * Delete a message template
   */
  async deleteTemplate(templateName: string): Promise<{ success: boolean }> {
    if (!this.businessAccountId) {
      throw new Error('Business account ID is required for template operations')
    }
    const response = await this.client.delete(`/${this.businessAccountId}/message_templates`, {
      params: { name: templateName },
    })
    return response.data
  }

  // ==========================================
  // Business Profile
  // ==========================================

  /**
   * Get business profile
   */
  async getBusinessProfile(): Promise<BusinessProfile> {
    const response = await this.client.get(`/${this.phoneNumberId}/whatsapp_business_profile`, {
      params: { fields: 'about,address,description,email,profile_picture_url,websites,vertical' },
    })
    return response.data.data[0]
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(profile: BusinessProfile): Promise<{ success: boolean }> {
    const response = await this.client.post(`/${this.phoneNumberId}/whatsapp_business_profile`, profile)
    return response.data
  }

  // ==========================================
  // Phone Numbers
  // ==========================================

  /**
   * Get phone number info
   */
  async getPhoneNumberInfo(): Promise<{
    id: string
    display_phone_number: string
    verified_name: string
    quality_rating: string
    platform_type: string
    throughput: { level: string }
  }> {
    const response = await this.client.get(`/${this.phoneNumberId}`, {
      params: { fields: 'id,display_phone_number,verified_name,quality_rating,platform_type,throughput' },
    })
    return response.data
  }

  /**
   * Request verification code
   */
  async requestVerificationCode(codeMethod: 'SMS' | 'VOICE', language: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/${this.phoneNumberId}/request_code`, {
      code_method: codeMethod,
      language,
    })
    return response.data
  }

  /**
   * Verify code
   */
  async verifyCode(code: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/${this.phoneNumberId}/verify_code`, { code })
    return response.data
  }

  /**
   * Register phone number
   */
  async registerPhoneNumber(pin: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/${this.phoneNumberId}/register`, {
      messaging_product: 'whatsapp',
      pin,
    })
    return response.data
  }
}

// Factory function to create client
export function createWhatsAppCloudClient(config: CloudApiConfig): WhatsAppCloudApiClient {
  return new WhatsAppCloudApiClient(config)
}
