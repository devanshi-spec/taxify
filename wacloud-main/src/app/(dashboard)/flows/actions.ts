
'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updateFlowJson(flowId: string, jsonString: string) {
    try {
        // Validate JSON
        const json = JSON.parse(jsonString)

        await prisma.whatsAppFlow.update({
            where: { id: flowId },
            data: {
                flowJson: json,
                updatedAt: new Date()
            }
        })
        revalidatePath(`/flows/${flowId}`)
        return { success: true }
    } catch (e) {
        return { success: false, error: "Invalid JSON" }
    }
}

export async function updateFlowStatus(flowId: string, status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED') {
    await prisma.whatsAppFlow.update({
        where: { id: flowId },
        data: { status }
    })
    revalidatePath(`/flows/${flowId}`)
}

export async function deleteFlow(flowId: string) {
    await prisma.whatsAppFlow.delete({ where: { id: flowId } })
    revalidatePath('/flows')
}
