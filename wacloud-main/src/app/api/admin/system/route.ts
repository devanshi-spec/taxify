import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withSuperAdmin } from '@/lib/auth/super-admin'
import os from 'os'

export async function GET() {
    return withSuperAdmin(async () => {
        const start = Date.now()
        let dbStatus = 'disconnected'
        let dbLatency = 0

        try {
            await prisma.$queryRaw`SELECT 1`
            dbStatus = 'connected'
            dbLatency = Date.now() - start
        } catch (error) {
            console.error('Database connection failed:', error)
            dbStatus = 'error'
        }

        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
            },
            uptime: os.uptime(),
        }

        return NextResponse.json({
            status: dbStatus === 'connected' ? 'healthy' : 'degraded',
            database: {
                status: dbStatus,
                latency: `${dbLatency}ms`,
            },
            system: systemInfo,
            timestamp: new Date().toISOString(),
        })
    })
}
