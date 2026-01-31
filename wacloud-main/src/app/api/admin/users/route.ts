import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withSuperAdmin } from '@/lib/auth/super-admin'

export async function GET(request: NextRequest) {
    return withSuperAdmin(async () => {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const search = searchParams.get('search') || ''
        const role = searchParams.get('role') || ''

        const skip = (page - 1) * limit

        // Build where clause
        const where: any = {}
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { organization: { name: { contains: search, mode: 'insensitive' } } },
            ]
        }
        if (role) {
            where.role = role
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ])

        return NextResponse.json({
            data: users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        })
    })
}
