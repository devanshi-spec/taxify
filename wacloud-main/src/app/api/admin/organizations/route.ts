import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withSuperAdmin } from '@/lib/auth/super-admin'

export async function GET(request: NextRequest) {
    return withSuperAdmin(async () => {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const search = searchParams.get('search') || ''
        const plan = searchParams.get('plan') || ''

        const skip = (page - 1) * limit

        // Build where clause
        const where: any = {}
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { billingEmail: { contains: search, mode: 'insensitive' } },
            ]
        }
        if (plan) {
            where.plan = plan
        }

        const [organizations, total] = await Promise.all([
            prisma.organization.findMany({
                where,
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            users: true,
                            channels: true,
                            contacts: true,
                            conversations: true,
                        },
                    },
                    subscription: {
                        select: {
                            status: true,
                            plan: true,
                            currentPeriodEnd: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.organization.count({ where }),
        ])

        return NextResponse.json({
            data: organizations,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        })
    })
}
