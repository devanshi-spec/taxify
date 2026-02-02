import { prisma } from '@/lib/db'
import { ActionType } from './types'

interface ActionContext {
    organizationId: string
    contactId: string
    variables?: Record<string, any>
}

export async function executeAction(
    type: ActionType,
    config: Record<string, any>,
    context: ActionContext
) {
    console.log(`[Automation] Executing action: ${type}`, { config, context })

    try {
        switch (type) {
            case 'ADD_TAG':
                await addTag(context.contactId, config.tag)
                break
            case 'CREATE_DEAL':
                await createDeal(context.organizationId, context.contactId, config)
                break
            case 'SEND_MESSAGE':
                await sendMessage(context.contactId, config.message, context.variables)
                break
            default:
                console.warn(`[Automation] Unknown action type: ${type}`)
        }
    } catch (error) {
        console.error(`[Automation] Action failed: ${type}`, error)
        throw error
    }
}

async function addTag(contactId: string, tag: string) {
    if (!tag) return

    await prisma.contact.update({
        where: { id: contactId },
        data: {
            tags: {
                push: tag
            }
        }
    })
}

async function createDeal(organizationId: string, contactId: string, config: any) {
    // Find default pipeline if not specified
    const pipelineId = config.pipelineId
    let finalPipelineId = pipelineId

    if (!pipelineId) {
        const defaultPipeline = await prisma.pipeline.findFirst({
            where: { organizationId }
        })
        if (defaultPipeline) finalPipelineId = defaultPipeline.id
    }

    if (!finalPipelineId) {
        throw new Error('No pipeline found for organization')
    }

    // Need to assign a creator. Finding an admin/owner for the org.
    const admin = await prisma.user.findFirst({
        where: { organizationId, role: 'OWNER' }
    })

    if (!admin) {
        throw new Error('No admin found to assign deal creation')
    }

    await prisma.deal.create({
        data: {
            title: config.title || 'New Deal from Automation',
            value: config.value || 0,
            currency: config.currency || 'USD',
            stage: config.stageId || 'new',
            contactId,
            pipelineId: finalPipelineId,
            organizationId,
            createdBy: admin.id
        }
    })
}

async function sendMessage(contactId: string, messageTemplate: string, variables: any) {
    // Placeholder for sending message logic
    // In a real app, this would call the WhatsApp API
    console.log(`[Automation] Sending message to ${contactId}:`, messageTemplate)

    // Create activity log
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { organizationId: true }
    })

    if (contact) {
        // Find a system user or assign to null (since creator is required, we need a valid ID)
        // For now, we'll try to find an admin or just log it if possible. 
        // Actually Activity.createdBy is required. 
        // We might need a "System User" in the DB.
        // Falling back to finding ANY admin for this organization to attribute to.
        const admin = await prisma.user.findFirst({
            where: { organizationId: contact.organizationId, role: 'OWNER' }
        })

        if (admin) {
            await prisma.activity.create({
                data: {
                    type: 'WHATSAPP',
                    title: 'Automated Message',
                    description: `Sent automated message: ${messageTemplate}`,
                    contactId,
                    organizationId: contact.organizationId,
                    createdBy: admin.id
                }
            })
        }
    }
}
