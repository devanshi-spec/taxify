
'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function addStep(sequenceId: string) {
    // Find current max order
    const lastStep = await prisma.campaign.findFirst({
        where: { dripSequenceId: sequenceId },
        orderBy: { dripStepOrder: 'desc' }
    })
    const newOrder = (lastStep?.dripStepOrder ?? 0) + 1

    // Find sequence to get channel/org
    const seq = await prisma.dripSequence.findUnique({ where: { id: sequenceId } })
    if (!seq) throw new Error("Sequence not found")

    await prisma.campaign.create({
        data: {
            name: `Step ${newOrder}`,
            type: 'DRIP',
            status: 'DRAFT',
            dripSequenceId: sequenceId,
            dripStepOrder: newOrder,
            dripDelayMinutes: 1440, // Default 1 day (24 * 60)
            channelId: seq.channelId,
            organizationId: seq.organizationId,
            createdBy: 'system', // Should be user ID ideally
            messageType: 'TEXT',
            messageContent: 'Hello! This is a follow-up message.',
        }
    })

    revalidatePath(`/drip-campaigns/${sequenceId}`)
}

export async function updateStep(stepId: string, data: {
    name?: string,
    dripDelayMinutes?: number,
    messageContent?: string
}) {
    await prisma.campaign.update({
        where: { id: stepId },
        data: {
            name: data.name,
            dripDelayMinutes: data.dripDelayMinutes,
            messageContent: data.messageContent
        }
    })
    // No revalidate needed often if optimistic, but good practice
    // We can't easily revalidate from here without path.
    // Assuming page handles it or we revalidate exact path if known.
}

export async function deleteStep(stepId: string, sequenceId: string) {
    await prisma.campaign.delete({ where: { id: stepId } })
    revalidatePath(`/drip-campaigns/${sequenceId}`)
}

export async function toggleSequenceStatus(sequenceId: string, isActive: boolean) {
    await prisma.dripSequence.update({
        where: { id: sequenceId },
        data: { isActive }
    })
    revalidatePath(`/drip-campaigns/${sequenceId}`)
}

export async function updateSequenceTrigger(sequenceId: string, trigger: string) {
    await prisma.dripSequence.update({
        where: { id: sequenceId },
        data: { entryTrigger: trigger }
    })
    revalidatePath(`/drip-campaigns/${sequenceId}`)
}
