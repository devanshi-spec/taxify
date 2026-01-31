import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withSuperAdmin } from '@/lib/auth/super-admin'

export async function GET() {
    return withSuperAdmin(async () => {
        // Get current month
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
        const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

        // Parallel queries for performance
        const [
            totalOrgs,
            activeSubscriptions,
            totalUsers,
            totalMessages,
            totalContacts,
            planDistribution,
            revenueData,
            currentMonthUsage,
            lastMonthUsage,
            recentOrgs,
        ] = await Promise.all([
            // Total organizations
            prisma.organization.count(),

            // Active subscriptions
            prisma.subscription.count({
                where: {
                    status: { in: ['ACTIVE', 'TRIALING'] },
                },
            }),

            // Total users
            prisma.user.count(),

            // Total messages (current month)
            prisma.monthlyUsage.aggregate({
                where: { month: currentMonth },
                _sum: { messagesSent: true },
            }),

            // Total contacts
            prisma.contact.count(),

            // Plan distribution
            prisma.organization.groupBy({
                by: ['plan'],
                _count: true,
            }),

            // Revenue calculation (active subscriptions)
            prisma.subscription.findMany({
                where: {
                    status: { in: ['ACTIVE', 'TRIALING'] },
                },
                select: { plan: true },
            }),

            // Current month usage
            prisma.monthlyUsage.aggregate({
                where: { month: currentMonth },
                _sum: {
                    messagesSent: true,
                    contactsActive: true,
                    aiTokensUsed: true,
                },
            }),

            // Last month usage
            prisma.monthlyUsage.aggregate({
                where: { month: lastMonthStr },
                _sum: {
                    messagesSent: true,
                    contactsActive: true,
                    aiTokensUsed: true,
                },
            }),

            // Recent organizations
            prisma.organization.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    plan: true,
                    createdAt: true,
                },
            }),
        ])

        // Calculate MRR (Monthly Recurring Revenue)
        const planPrices: Record<string, number> = {
            FREE: 0,
            STARTER: 29,
            PROFESSIONAL: 99,
            ENTERPRISE: 299,
        }

        const mrr = revenueData.reduce((sum: number, sub: { plan: string }) => {
            return sum + (planPrices[sub.plan] || 0)
        }, 0)

        const arr = mrr * 12

        // Calculate growth
        const messageGrowth = lastMonthUsage._sum.messagesSent
            ? ((currentMonthUsage._sum.messagesSent || 0) - lastMonthUsage._sum.messagesSent) /
            lastMonthUsage._sum.messagesSent *
            100
            : 0

        return NextResponse.json({
            data: {
                overview: {
                    totalOrganizations: totalOrgs,
                    activeSubscriptions,
                    totalUsers,
                    totalContacts,
                    mrr,
                    arr,
                },
                usage: {
                    currentMonth: {
                        messages: currentMonthUsage._sum.messagesSent || 0,
                        contacts: currentMonthUsage._sum.contactsActive || 0,
                        aiTokens: currentMonthUsage._sum.aiTokensUsed || 0,
                    },
                    lastMonth: {
                        messages: lastMonthUsage._sum.messagesSent || 0,
                        contacts: lastMonthUsage._sum.contactsActive || 0,
                        aiTokens: lastMonthUsage._sum.aiTokensUsed || 0,
                    },
                    growth: {
                        messages: messageGrowth.toFixed(1),
                    },
                },
                plans: planDistribution.map((p: { plan: string; _count: number }) => ({
                    plan: p.plan,
                    count: p._count,
                })),
                recentOrganizations: recentOrgs,
            },
        })
    })
}
