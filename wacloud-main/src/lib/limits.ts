import { prisma } from '@/lib/db'
import { STRIPE_PLANS, PlanType } from './stripe'

/**
 * Get current month string (YYYY-MM format)
 */
function getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get or create monthly usage record
 */
async function getOrCreateMonthlyUsage(organizationId: string) {
    const month = getCurrentMonth()

    let usage = await prisma.monthlyUsage.findUnique({
        where: {
            organizationId_month: {
                organizationId,
                month,
            },
        },
    })

    if (!usage) {
        usage = await prisma.monthlyUsage.create({
            data: {
                organizationId,
                month,
                messagesSent: 0,
                contactsActive: 0,
                aiTokensUsed: 0,
                storageUsedMB: 0,
            },
        })
    }

    return usage
}

/**
 * Get organization with plan limits
 */
async function getOrganizationLimits(organizationId: string) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            plan: true,
            maxUsers: true,
            maxChannels: true,
            maxContacts: true,
            maxMessages: true,
        },
    })

    if (!org) {
        throw new Error('Organization not found')
    }

    return org
}

/**
 * Check if organization can perform an action
 */
export async function checkLimit(
    organizationId: string,
    resource: 'users' | 'channels' | 'contacts' | 'messages' | 'ai_tokens'
): Promise<{ allowed: boolean; current: number; limit: number; percentage: number }> {
    const org = await getOrganizationLimits(organizationId)

    let current = 0
    let limit = 0

    switch (resource) {
        case 'users':
            current = await prisma.user.count({
                where: { organizationId },
            })
            limit = org.maxUsers
            break

        case 'channels':
            current = await prisma.channel.count({
                where: { organizationId },
            })
            limit = org.maxChannels
            break

        case 'contacts':
            current = await prisma.contact.count({
                where: { organizationId },
            })
            limit = org.maxContacts
            break

        case 'messages':
            const usage = await getOrCreateMonthlyUsage(organizationId)
            current = usage.messagesSent
            limit = org.maxMessages
            break

        case 'ai_tokens':
            const aiUsage = await getOrCreateMonthlyUsage(organizationId)
            current = aiUsage.aiTokensUsed
            // AI tokens limit: 10x message limit (rough estimate)
            limit = org.maxMessages * 10
            break
    }

    const percentage = limit > 0 ? (current / limit) * 100 : 0
    const allowed = current < limit

    return {
        allowed,
        current,
        limit,
        percentage,
    }
}

/**
 * Enforce limit - throws error if exceeded
 */
export async function enforceLimit(
    organizationId: string,
    resource: 'users' | 'channels' | 'contacts' | 'messages' | 'ai_tokens'
): Promise<void> {
    const check = await checkLimit(organizationId, resource)

    if (!check.allowed) {
        const resourceName = resource.replace('_', ' ')
        throw new Error(
            `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} limit reached (${check.current}/${check.limit}). Please upgrade your plan.`
        )
    }
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
    organizationId: string,
    resource: 'messages' | 'contacts' | 'ai_tokens' | 'storage',
    amount: number = 1
): Promise<void> {
    const month = getCurrentMonth()

    await prisma.monthlyUsage.upsert({
        where: {
            organizationId_month: {
                organizationId,
                month,
            },
        },
        create: {
            organizationId,
            month,
            messagesSent: resource === 'messages' ? amount : 0,
            contactsActive: resource === 'contacts' ? amount : 0,
            aiTokensUsed: resource === 'ai_tokens' ? amount : 0,
            storageUsedMB: resource === 'storage' ? amount : 0,
        },
        update: {
            messagesSent: resource === 'messages' ? { increment: amount } : undefined,
            contactsActive: resource === 'contacts' ? { increment: amount } : undefined,
            aiTokensUsed: resource === 'ai_tokens' ? { increment: amount } : undefined,
            storageUsedMB: resource === 'storage' ? { increment: amount } : undefined,
        },
    })
}

/**
 * Get usage statistics for organization
 */
export async function getUsageStats(organizationId: string) {
    const org = await getOrganizationLimits(organizationId)
    const usage = await getOrCreateMonthlyUsage(organizationId)

    const userCount = await prisma.user.count({
        where: { organizationId },
    })

    const channelCount = await prisma.channel.count({
        where: { organizationId },
    })

    const contactCount = await prisma.contact.count({
        where: { organizationId },
    })

    return {
        plan: org.plan,
        users: {
            current: userCount,
            limit: org.maxUsers,
            percentage: (userCount / org.maxUsers) * 100,
        },
        channels: {
            current: channelCount,
            limit: org.maxChannels,
            percentage: (channelCount / org.maxChannels) * 100,
        },
        contacts: {
            current: contactCount,
            limit: org.maxContacts,
            percentage: (contactCount / org.maxContacts) * 100,
        },
        messages: {
            current: usage.messagesSent,
            limit: org.maxMessages,
            percentage: (usage.messagesSent / org.maxMessages) * 100,
        },
        aiTokens: {
            current: usage.aiTokensUsed,
            limit: org.maxMessages * 10,
            percentage: (usage.aiTokensUsed / (org.maxMessages * 10)) * 100,
        },
        storage: {
            current: usage.storageUsedMB,
            limit: 1000, // 1GB default
            percentage: (usage.storageUsedMB / 1000) * 100,
        },
    }
}

/**
 * Check if organization should see upgrade prompt
 */
export async function shouldShowUpgradePrompt(
    organizationId: string
): Promise<{ show: boolean; reason?: string }> {
    const stats = await getUsageStats(organizationId)

    // Show prompt if any resource is above 80%
    if (stats.messages.percentage >= 80) {
        return {
            show: true,
            reason: `You've used ${stats.messages.percentage.toFixed(0)}% of your monthly message limit`,
        }
    }

    if (stats.contacts.percentage >= 80) {
        return {
            show: true,
            reason: `You've used ${stats.contacts.percentage.toFixed(0)}% of your contact limit`,
        }
    }

    if (stats.users.percentage >= 80) {
        return {
            show: true,
            reason: `You've used ${stats.users.percentage.toFixed(0)}% of your user limit`,
        }
    }

    if (stats.channels.percentage >= 80) {
        return {
            show: true,
            reason: `You've used ${stats.channels.percentage.toFixed(0)}% of your channel limit`,
        }
    }

    return { show: false }
}
