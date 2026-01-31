import { prisma } from '@/lib/db'

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  example?: {
    header_text?: string[]
    body_text?: string[][]
  }
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
    text: string
    url?: string
    phone_number?: string
  }>
}

export interface WhatsAppTemplate {
  id: string
  name: string
  language: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED'
  components: TemplateComponent[]
  qualityScore?: {
    score: string
    date: string
  }
}

export interface TemplateVariable {
  index: number
  component: 'HEADER' | 'BODY'
  placeholder: string
  example?: string
}

export class TemplateService {
  /**
   * Sync templates from Meta API for a channel
   * Note: Requires Meta API access token to be configured in channel settings
   */
  async syncTemplates(channelId: string, accessToken?: string): Promise<{ synced: number; errors: string[] }> {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        wabaId: true,
        settings: true,
      },
    })

    if (!channel || !channel.wabaId) {
      throw new Error('Channel not configured for templates')
    }

    // Get access token from settings or parameter
    const settings = channel.settings as Record<string, unknown> | null
    const token = accessToken || (settings?.accessToken as string | undefined)

    if (!token) {
      throw new Error('Meta API access token not configured. Please add it to channel settings.')
    }

    const errors: string[] = []
    let synced = 0

    try {
      // Fetch templates from Meta API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${channel.wabaId}/message_templates?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to fetch templates')
      }

      const data = await response.json()
      const templates = data.data || []

      // Process each template
      for (const template of templates) {
        try {
          // Extract body text from components
          const bodyComponent = template.components?.find((c: { type: string }) => c.type === 'BODY')
          const bodyText = bodyComponent?.text || ''

          await prisma.messageTemplate.upsert({
            where: {
              name_language_channelId: {
                name: template.name,
                language: template.language,
                channelId,
              },
            },
            update: {
              waTemplateId: template.id,
              category: template.category,
              status: template.status,
              bodyText,
            },
            create: {
              waTemplateId: template.id,
              name: template.name,
              language: template.language,
              category: template.category,
              status: template.status,
              bodyText,
              channelId,
            },
          })
          synced++
        } catch (err) {
          errors.push(`Failed to sync ${template.name}: ${err}`)
        }
      }
    } catch (error) {
      throw error
    }

    return { synced, errors }
  }

  /**
   * Get templates for a channel
   */
  async getTemplates(channelId: string, filters?: {
    status?: string
    category?: string
    search?: string
  }) {
    const where: Record<string, unknown> = { channelId }

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.category) {
      where.category = filters.category
    }

    if (filters?.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      }
    }

    return prisma.messageTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    })
  }

  /**
   * Parse template variables from components
   */
  parseVariables(components: TemplateComponent[]): TemplateVariable[] {
    const variables: TemplateVariable[] = []
    let index = 1

    for (const component of components) {
      if (component.type === 'HEADER' && component.text) {
        const matches = component.text.match(/\{\{\d+\}\}/g) || []
        for (const match of matches) {
          variables.push({
            index,
            component: 'HEADER',
            placeholder: match,
            example: component.example?.header_text?.[0],
          })
          index++
        }
      }

      if (component.type === 'BODY' && component.text) {
        const matches = component.text.match(/\{\{\d+\}\}/g) || []
        for (const match of matches) {
          const exampleIndex = parseInt(match.replace(/\D/g, '')) - 1
          variables.push({
            index,
            component: 'BODY',
            placeholder: match,
            example: component.example?.body_text?.[0]?.[exampleIndex],
          })
          index++
        }
      }
    }

    return variables
  }

  /**
   * Render template with variable values
   */
  renderTemplate(
    components: TemplateComponent[],
    values: Record<string, string>
  ): string {
    let result = ''

    for (const component of components) {
      if (component.type === 'HEADER' && component.text) {
        let headerText = component.text
        for (const [key, value] of Object.entries(values)) {
          headerText = headerText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        }
        result += `*${headerText}*\n\n`
      }

      if (component.type === 'BODY' && component.text) {
        let bodyText = component.text
        for (const [key, value] of Object.entries(values)) {
          bodyText = bodyText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        }
        result += `${bodyText}\n\n`
      }

      if (component.type === 'FOOTER' && component.text) {
        result += `_${component.text}_\n`
      }

      if (component.type === 'BUTTONS' && component.buttons) {
        for (const button of component.buttons) {
          result += `[${button.text}]\n`
        }
      }
    }

    return result.trim()
  }

  /**
   * Build template message payload for WhatsApp API
   */
  buildTemplatePayload(
    templateName: string,
    language: string,
    components: TemplateComponent[],
    values: Record<string, string>,
    headerMediaUrl?: string
  ) {
    const templateComponents: Array<{
      type: string
      parameters?: Array<{ type: string; text?: string; image?: { link: string } }>
    }> = []

    for (const component of components) {
      if (component.type === 'HEADER') {
        if (component.format === 'IMAGE' && headerMediaUrl) {
          templateComponents.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: headerMediaUrl } }],
          })
        } else if (component.format === 'TEXT' && component.text?.includes('{{')) {
          const params = []
          const matches = component.text.match(/\{\{(\d+)\}\}/g) || []
          for (const match of matches) {
            const key = match.replace(/\D/g, '')
            params.push({ type: 'text', text: values[key] || '' })
          }
          templateComponents.push({ type: 'header', parameters: params })
        }
      }

      if (component.type === 'BODY' && component.text?.includes('{{')) {
        const params = []
        const matches = component.text.match(/\{\{(\d+)\}\}/g) || []
        for (const match of matches) {
          const key = match.replace(/\D/g, '')
          params.push({ type: 'text', text: values[key] || '' })
        }
        templateComponents.push({ type: 'body', parameters: params })
      }
    }

    return {
      name: templateName,
      language: { code: language },
      components: templateComponents.length > 0 ? templateComponents : undefined,
    }
  }
}

// Singleton instance
let templateService: TemplateService | null = null

export function getTemplateService(): TemplateService {
  if (!templateService) {
    templateService = new TemplateService()
  }
  return templateService
}
