
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWhatsAppService } from '@/lib/services/whatsapp-service'

export async function GET() {
    try {
        const now = new Date()
        const whatsappService = getWhatsAppService()

        // 1. Find active enrollments ready for next message
        const enrollments = await prisma.dripEnrollment.findMany({
            where: {
                status: 'ACTIVE',
                nextMessageAt: { lte: now },
                sequence: { isActive: true } // Only if sequence is still active
            },
            include: {
                sequence: {
                    include: {
                        channel: true // Get channel config (tokens, etc.)
                    }
                },
                contact: true,
            }
        })

        if (enrollments.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No pending drip actions' })
        }

        let processed = 0
        let errors = 0

        for (const enrollment of enrollments) {
            try {
                const nextStepOrder = enrollment.currentStep + 1
                const sequence = enrollment.sequence
                const channel = sequence.channel
                const contact = enrollment.contact

                if (!channel) {
                    console.error(`[Drip] Enrollment ${enrollment.id} has no channel associated with sequence`)
                    errors++
                    continue
                }

                // Find the step (Campaign)
                const step = await prisma.campaign.findFirst({
                    where: {
                        dripSequenceId: enrollment.sequenceId,
                        dripStepOrder: nextStepOrder
                    }
                })

                if (!step) {
                    // No more steps, mark completed
                    await prisma.dripEnrollment.update({
                        where: { id: enrollment.id },
                        data: {
                            status: 'COMPLETED',
                            completedAt: new Date(),
                            nextMessageAt: null
                        }
                    })
                    continue
                }

                // Create conversation context if not exists, or get latest
                // We typically need a conversation ID for the Message record
                let conversation = await prisma.conversation.findFirst({
                    where: {
                        contactId: contact.id,
                        channelId: channel.id,
                        status: { not: 'CLOSED' }
                    },
                    orderBy: { updatedAt: 'desc' }
                })

                if (!conversation) {
                    conversation = await prisma.conversation.create({
                        data: {
                            contactId: contact.id,
                            channelId: channel.id,
                            organizationId: channel.organizationId,
                            status: 'OPEN'
                        }
                    })
                }

                // Send the message based on type
                console.log(`[Drip] Sending Step ${step.name} to ${contact.phoneNumber}`)

                if (step.messageType === 'TEXT' && step.messageContent) {
                    await whatsappService.sendTextMessage(
                        channel,
                        contact,
                        step.messageContent,
                        conversation.id
                    )
                } else if (step.messageType === 'IMAGE' || step.messageType === 'VIDEO' || step.messageType === 'DOCUMENT' || step.messageType === 'AUDIO') {
                    if (step.mediaUrl) {
                        const typeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
                            'IMAGE': 'image',
                            'VIDEO': 'video',
                            'AUDIO': 'audio',
                            'DOCUMENT': 'document'
                        }
                        await whatsappService.sendMediaMessage(
                            channel,
                            contact,
                            step.mediaUrl,
                            typeMap[step.messageType],
                            step.messageContent || undefined, // Caption
                            conversation.id
                        )
                    }
                } else {
                    console.warn(`[Drip] Unsupported message type for step: ${step.messageType}`)
                }

                // Calculate NEXT step delay to schedule next run
                const nextStep2 = await prisma.campaign.findFirst({
                    where: {
                        dripSequenceId: enrollment.sequenceId,
                        dripStepOrder: nextStepOrder + 1
                    }
                })

                let nextMessageDate = null
                if (nextStep2 && nextStep2.dripDelayMinutes !== null) {
                    const nextDelayMs = (nextStep2.dripDelayMinutes || 0) * 60 * 1000
                    nextMessageDate = new Date(Date.now() + nextDelayMs)
                }

                // If there IS a next step but delay is null/0, it might be immediate.
                // For safety, we set it to now so it picks up next cycle? Or maybe 1 min later.
                if (nextStep2 && !nextMessageDate) {
                    nextMessageDate = new Date() // Process ASAP
                }

                await prisma.dripEnrollment.update({
                    where: { id: enrollment.id },
                    data: {
                        currentStep: nextStepOrder,
                        nextMessageAt: nextMessageDate,
                    }
                })

                // If no next step, mark complete now? 
                // Logic above: "if (!step) ... mark completed". 
                // So in the NEXT run, it will fail to find 'nextStepOrder' and mark complete.
                // This is fine.

                processed++
            } catch (err) {
                console.error(`Error processing enrollment ${enrollment.id}:`, err)
                errors++
            }
        }

        return NextResponse.json({ success: true, processed, errors })
    } catch (error) {
        console.error('Drip process error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
