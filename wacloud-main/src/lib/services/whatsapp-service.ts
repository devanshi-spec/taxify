import { prisma } from '@/lib/db'
import { EvolutionApiClient } from '@/lib/evolution-api/client'
import { WhatsAppCloudApiClient } from '@/lib/evolution-api/whatsapp-cloud'
import type { Channel, Contact, Message } from '@prisma/client'

export class WhatsAppService {
    /**
     * Send a text message to a contact via the specified channel
     */
    async sendTextMessage(
        channel: Channel,
        contact: Contact,
        text: string,
        conversationId: string
    ): Promise<Message> {
        // Create message record first
        const message = await prisma.message.create({
            data: {
                conversationId,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: text,
                status: 'PENDING',
                isAiGenerated: false,
            },
        })

        try {
            if (channel.connectionType === 'EVOLUTION_API' && channel.evolutionInstance) {
                await this.sendViaEvolution(channel, contact, message, 'text', { text })
            } else if (channel.connectionType === 'CLOUD_API' && channel.phoneNumberId) {
                await this.sendViaCloudApi(channel, contact, message, 'text', { text })
            } else {
                throw new Error(`Unsupported channel connection type: ${channel.connectionType}`)
            }

            return message
        } catch (error) {
            console.error('[WhatsAppService] Send failed:', error)
            await prisma.message.update({
                where: { id: message.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
            })
            throw error // Re-throw to caller knows
        }
    }

    /**
     * Send media message
     */
    async sendMediaMessage(
        channel: Channel,
        contact: Contact,
        url: string,
        type: 'image' | 'video' | 'audio' | 'document',
        caption: string | undefined,
        conversationId: string
    ): Promise<Message> {
        // Create message record
        const messageTypeMap = {
            image: 'IMAGE',
            video: 'VIDEO',
            audio: 'AUDIO',
            document: 'DOCUMENT'
        } as const;

        const message = await prisma.message.create({
            data: {
                conversationId,
                direction: 'OUTBOUND',
                type: messageTypeMap[type],
                mediaUrl: url,
                mediaType: type,
                content: caption,
                status: 'PENDING',
                isAiGenerated: false,
            },
        })

        try {
            if (channel.connectionType === 'EVOLUTION_API' && channel.evolutionInstance) {
                await this.sendViaEvolution(channel, contact, message, 'media', { url, type, caption })
            } else if (channel.connectionType === 'CLOUD_API' && channel.phoneNumberId) {
                await this.sendViaCloudApi(channel, contact, message, 'media', { url, type, caption })
            }
            return message
        } catch (error) {
            console.error('[WhatsAppService] Send media failed:', error)
            await prisma.message.update({
                where: { id: message.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
            })
            throw error
        }
    }

    // --- Private Implementation Helpers ---

    private async sendViaEvolution(
        channel: Channel,
        contact: Contact,
        message: Message,
        type: 'text' | 'media',
        payload: any
    ) {
        if (!channel.evolutionInstance) throw new Error('No Evolution instance ID')

        const evolutionClient = new EvolutionApiClient({
            baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
            apiKey: channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
        })

        const phoneNumber = contact.phoneNumber.replace(/\D/g, '')
        let result

        if (type === 'text') {
            result = await evolutionClient.sendText(channel.evolutionInstance, {
                number: phoneNumber,
                text: payload.text,
            })
        } else if (type === 'media') {
            const mimetypeMap: Record<string, string> = {
                image: 'image/jpeg',
                video: 'video/mp4',
                audio: 'audio/mpeg',
                document: 'application/pdf',
            }
            result = await evolutionClient.sendMedia(channel.evolutionInstance, {
                number: phoneNumber,
                mediatype: payload.type,
                mimetype: mimetypeMap[payload.type] || 'application/octet-stream',
                media: payload.url,
                caption: payload.caption
            })
        }

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
    }

    private async sendViaCloudApi(
        channel: Channel,
        contact: Contact,
        message: Message,
        type: 'text' | 'media',
        payload: any
    ) {
        const settings = channel.settings as { accessToken?: string } | null
        const accessToken = settings?.accessToken || process.env.META_ACCESS_TOKEN

        if (!accessToken) throw new Error('No Meta Access Token')

        const cloudClient = new WhatsAppCloudApiClient({
            accessToken,
            phoneNumberId: channel.phoneNumberId!,
            businessAccountId: channel.wabaId || undefined,
        })

        const phoneNumber = contact.phoneNumber.replace(/\D/g, '')
        let waMessageId: string | null = null

        if (type === 'text') {
            const response = await cloudClient.sendText({
                to: phoneNumber,
                text: { body: payload.text },
            })
            waMessageId = response.messages?.[0]?.id || null
        } else if (type === 'media') {
            if (payload.type === 'image') {
                const response = await cloudClient.sendMedia({
                    to: phoneNumber,
                    type: 'image',
                    image: { link: payload.url, caption: payload.caption }
                })
                waMessageId = response.messages?.[0]?.id || null
            }
            // Add other media types as needed
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

// Singleton
let service: WhatsAppService | null = null
export function getWhatsAppService() {
    if (!service) service = new WhatsAppService()
    return service
}
