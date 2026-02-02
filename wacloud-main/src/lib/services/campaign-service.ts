import { prisma } from '@/lib/db'
import { EvolutionApiClient } from '@/lib/evolution-api/client'
import { WhatsAppCloudApiClient } from '@/lib/evolution-api/whatsapp-cloud'
import type { Campaign, Contact, Channel } from '@prisma/client'
import type { Prisma } from '@prisma/client'

interface CampaignExecutionResult {
  success: boolean
  totalRecipients: number
  sentCount: number
  failedCount: number
  errors: string[]
}

export class CampaignService {
  /**
   * Start executing a campaign
   */
  async executeCampaign(campaignId: string): Promise<CampaignExecutionResult> {
    const result: CampaignExecutionResult = {
      success: false,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [],
    }

    try {
      // Get campaign with channel
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { channel: true },
      })

      if (!campaign) {
        result.errors.push('Campaign not found')
        return result
      }

      if (campaign.status !== 'SCHEDULED' && campaign.status !== 'DRAFT') {
        result.errors.push(`Campaign cannot be started. Current status: ${campaign.status}`)
        return result
      }

      // Update campaign status to running
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      // Get target contacts
      const contacts = await this.getTargetContacts(campaign)
      result.totalRecipients = contacts.length

      if (contacts.length === 0) {
        result.errors.push('No contacts match the campaign criteria')
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        return result
      }

      // Create campaign contacts records
      await this.createCampaignContacts(campaignId, contacts)

      // Update total recipients
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { totalRecipients: contacts.length },
      })

      // Send messages with rate limiting
      const sendResult = await this.sendCampaignMessages(campaign, contacts)
      result.sentCount = sendResult.sentCount
      result.failedCount = sendResult.failedCount
      result.errors = sendResult.errors

      // Update campaign status
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        },
      })

      result.success = true
      return result
    } catch (error) {
      console.error('[Campaign] Execution error:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' },
      })

      return result
    }
  }

  /**
   * Get contacts matching campaign criteria
   */
  private async getTargetContacts(campaign: Campaign): Promise<Contact[]> {
    const where: Record<string, unknown> = {
      organizationId: campaign.organizationId,
      channelId: campaign.channelId,
      isOptedIn: true,
    }

    // Filter by segment
    if (campaign.targetSegment) {
      where.segment = campaign.targetSegment
    }

    // Filter by tags
    if (campaign.targetTags && campaign.targetTags.length > 0) {
      where.tags = { hasSome: campaign.targetTags }
    }

    // Custom filters
    if (campaign.targetFilters) {
      const filters = campaign.targetFilters as Record<string, unknown>

      if (filters.stage) {
        where.stage = filters.stage
      }

      if (filters.minLeadScore) {
        where.leadScore = { gte: filters.minLeadScore }
      }

      if (filters.lastContactedBefore) {
        where.lastContactedAt = { lt: new Date(filters.lastContactedBefore as string) }
      }
    }

    return prisma.contact.findMany({ where })
  }

  /**
   * Create campaign contact records
   */
  private async createCampaignContacts(campaignId: string, contacts: Contact[]): Promise<void> {
    // Delete existing records
    await prisma.campaignContact.deleteMany({
      where: { campaignId },
    })

    // Create new records
    await prisma.campaignContact.createMany({
      data: contacts.map(contact => ({
        campaignId,
        contactId: contact.id,
        status: 'PENDING',
      })),
    })
  }

  /**
   * Send campaign messages with rate limiting
   */
  private async sendCampaignMessages(
    campaign: Campaign & { channel: Channel },
    contacts: Contact[]
  ): Promise<{ sentCount: number; failedCount: number; errors: string[] }> {
    let sentCount = 0
    let failedCount = 0
    const errors: string[] = []

    const { channel } = campaign
    const messagesPerSecond = campaign.messagesPerSecond || 1
    const delayMs = 1000 / messagesPerSecond

    // Initialize Evolution API client
    let evolutionClient: EvolutionApiClient | null = null
    if (channel.connectionType === 'EVOLUTION_API' && channel.evolutionInstance) {
      evolutionClient = new EvolutionApiClient({
        baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
      })
    }

    for (const contact of contacts) {
      try {
        // Check if campaign was paused/cancelled
        const currentCampaign = await prisma.campaign.findUnique({
          where: { id: campaign.id },
          select: { status: true },
        })

        if (currentCampaign?.status === 'PAUSED' || currentCampaign?.status === 'CANCELLED') {
          console.log('[Campaign] Campaign stopped, halting execution')
          break
        }

        // Get or create conversation
        let conversation = await prisma.conversation.findFirst({
          where: {
            contactId: contact.id,
            channelId: channel.id,
            status: { in: ['OPEN', 'PENDING'] },
          },
        })

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              contactId: contact.id,
              channelId: channel.id,
              organizationId: campaign.organizationId,
              status: 'OPEN',
              priority: 'NORMAL',
              tags: [],
            },
          })
        }

        // Create message in database
        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            type: campaign.messageType,
            content: this.personalizeContent(campaign.messageContent, contact),
            mediaUrl: campaign.mediaUrl,
            templateId: campaign.templateId,
            templateParams: campaign.templateParams as Prisma.InputJsonValue | undefined,
            status: 'PENDING',
            isAiGenerated: false,
          },
        })

        // Send via WhatsApp
        if (evolutionClient && channel.evolutionInstance) {
          const phoneNumber = contact.phoneNumber.replace(/\D/g, '')

          try {
            let waResult
            if (campaign.messageType === 'TEXT' && campaign.messageContent) {
              waResult = await evolutionClient.sendText(channel.evolutionInstance, {
                number: phoneNumber,
                text: this.personalizeContent(campaign.messageContent, contact) || '',
              })
            } else if (campaign.messageType === 'IMAGE' && campaign.mediaUrl) {
              waResult = await evolutionClient.sendMedia(channel.evolutionInstance, {
                number: phoneNumber,
                mediatype: 'image',
                mimetype: 'image/*',
                media: campaign.mediaUrl,
                caption: campaign.messageContent || undefined,
              })
            }

            // Update message status
            await prisma.message.update({
              where: { id: message.id },
              data: {
                waMessageId: waResult?.key?.id,
                status: 'SENT',
                sentAt: new Date(),
              },
            })

            // Update campaign contact status
            await prisma.campaignContact.updateMany({
              where: { campaignId: campaign.id, contactId: contact.id },
              data: {
                status: 'SENT',
                messageId: message.id,
                sentAt: new Date(),
              },
            })

            sentCount++
          } catch (sendError) {
            console.error(`[Campaign] Failed to send to ${contact.phoneNumber}:`, sendError)

            await prisma.message.update({
              where: { id: message.id },
              data: {
                status: 'FAILED',
                errorMessage: sendError instanceof Error ? sendError.message : 'Send failed',
              },
            })

            await prisma.campaignContact.updateMany({
              where: { campaignId: campaign.id, contactId: contact.id },
              data: {
                status: 'FAILED',
                failedAt: new Date(),
                errorMessage: sendError instanceof Error ? sendError.message : 'Send failed',
              },
            })

            failedCount++
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

            try {
              let waResult
              if (campaign.messageType === 'TEXT' && campaign.messageContent) {
                waResult = await cloudClient.sendText({
                  to: phoneNumber,
                  text: { body: this.personalizeContent(campaign.messageContent, contact) },
                })
              } else if (campaign.messageType === 'IMAGE' && campaign.mediaUrl) {
                waResult = await cloudClient.sendMedia({
                  to: phoneNumber,
                  type: 'image',
                  image: {
                    link: campaign.mediaUrl,
                    caption: this.personalizeContent(campaign.messageContent, contact)
                  },
                })
              } else if (campaign.messageType === 'TEMPLATE' && campaign.templateId) {
                // For template messages - get template from DB and send
                const template = await prisma.messageTemplate.findUnique({
                  where: { id: campaign.templateId }
                })
                if (template) {
                  waResult = await cloudClient.sendTemplate({
                    to: phoneNumber,
                    template: {
                      name: template.name,
                      language: { code: template.language || 'en' },
                      // Note: components would need to be built from templateParams
                    },
                  })
                }
              }

              // Update message status
              await prisma.message.update({
                where: { id: message.id },
                data: {
                  waMessageId: waResult?.messages?.[0]?.id,
                  status: 'SENT',
                  sentAt: new Date(),
                },
              })

              // Update campaign contact status
              await prisma.campaignContact.updateMany({
                where: { campaignId: campaign.id, contactId: contact.id },
                data: {
                  status: 'SENT',
                  messageId: message.id,
                  sentAt: new Date(),
                },
              })

              sentCount++
            } catch (sendError) {
              console.error(`[Campaign] Failed to send to ${contact.phoneNumber}:`, sendError)

              await prisma.message.update({
                where: { id: message.id },
                data: {
                  status: 'FAILED',
                  errorMessage: sendError instanceof Error ? sendError.message : 'Send failed',
                },
              })

              await prisma.campaignContact.updateMany({
                where: { campaignId: campaign.id, contactId: contact.id },
                data: {
                  status: 'FAILED',
                  failedAt: new Date(),
                  errorMessage: sendError instanceof Error ? sendError.message : 'Send failed',
                },
              })

              failedCount++
            }
          } else {
            // No access token
            failedCount++
            errors.push(`No access token configured for Cloud API channel ${channel.id}`)
          }
        } else {
          // No WhatsApp client - mark as failed
          failedCount++
          errors.push(`No WhatsApp client configured for channel ${channel.id}`)
        }

        // Update campaign progress
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            sentCount,
            failedCount,
          },
        })

        // Rate limiting delay
        await this.delay(delayMs)
      } catch (contactError) {
        console.error(`[Campaign] Error processing contact ${contact.id}:`, contactError)
        failedCount++
      }
    }

    return { sentCount, failedCount, errors }
  }

  /**
   * Personalize message content with contact data
   */
  private personalizeContent(content: string | null, contact: Contact): string {
    if (!content) return ''

    return content
      .replace(/\{\{name\}\}/gi, contact.name || 'Customer')
      .replace(/\{\{first_name\}\}/gi, contact.name?.split(' ')[0] || 'Customer')
      .replace(/\{\{phone\}\}/gi, contact.phoneNumber)
      .replace(/\{\{email\}\}/gi, contact.email || '')
  }

  /**
   * Pause a running campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    })
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<CampaignExecutionResult> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign || campaign.status !== 'PAUSED') {
      return {
        success: false,
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['Campaign not found or not paused'],
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SCHEDULED' },
    })

    return this.executeCampaign(campaignId)
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    })
  }

  /**
   * Schedule a campaign for later execution
   */
  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'SCHEDULED',
        scheduledAt,
      },
    })
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<{
    total: number
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
  }> {
    const stats = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    })

    const result = {
      total: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
    }

    for (const stat of stats) {
      result.total += stat._count
      switch (stat.status) {
        case 'SENT':
          result.sent = stat._count
          break
        case 'DELIVERED':
          result.delivered = stat._count
          break
        case 'READ':
          result.read = stat._count
          break
        case 'REPLIED':
          result.replied = stat._count
          break
        case 'FAILED':
          result.failed = stat._count
          break
      }
    }

    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance
let campaignService: CampaignService | null = null

export function getCampaignService(): CampaignService {
  if (!campaignService) {
    campaignService = new CampaignService()
  }
  return campaignService
}
