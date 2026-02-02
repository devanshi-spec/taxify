import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { Queue } from 'bullmq'
import { getRedisConnection } from '@/lib/queue/redis'

// Queue for scheduled messages
const SCHEDULED_MESSAGE_QUEUE = 'scheduled-messages'

let scheduledMessageQueue: Queue | null = null

function getScheduledMessageQueue(): Queue {
    if (!scheduledMessageQueue) {
        scheduledMessageQueue = new Queue(SCHEDULED_MESSAGE_QUEUE, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 500,
                attempts: 3,
            },
        })
    }
    return scheduledMessageQueue
}

// Validation schema
const scheduleMessageSchema = z.object({
    conversationId: z.string(),
    content: z.string().optional(),
    type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE']).default('TEXT'),
    mediaUrl: z.string().optional(),
    mediaCaption: z.string().optional(),
    templateId: z.string().optional(),
    templateParams: z.record(z.string(), z.string()).optional(),
    scheduledAt: z.string().datetime(),
})

// GET - List scheduled messages
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const conversationId = searchParams.get('conversationId')

        // Get scheduled messages from queue
        const queue = getScheduledMessageQueue()
        const delayedJobs = await queue.getDelayed()

        // Filter by organization and optionally conversation
        const scheduledMessages = delayedJobs
            .filter((job) => {
                const data = job.data as Record<string, unknown>
                if (data.organizationId !== dbUser.organizationId) return false
                if (conversationId && data.conversationId !== conversationId) return false
                return true
            })
            .map((job) => ({
                id: job.id,
                conversationId: job.data.conversationId,
                content: job.data.content,
                type: job.data.type,
                scheduledAt: new Date(job.timestamp + (job.opts.delay || 0)).toISOString(),
                createdAt: new Date(job.timestamp).toISOString(),
            }))

        return NextResponse.json({ data: scheduledMessages })
    } catch (error) {
        console.error('Error fetching scheduled messages:', error)
        return NextResponse.json(
            { error: 'Failed to fetch scheduled messages' },
            { status: 500 }
        )
    }
}

// POST - Schedule a new message
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const body = await request.json()
        const validationResult = scheduleMessageSchema.safeParse(body)

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: validationResult.error.issues },
                { status: 400 }
            )
        }

        const data = validationResult.data

        // Verify conversation belongs to user's organization
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: data.conversationId,
                organizationId: dbUser.organizationId,
            },
            include: {
                contact: true,
                channel: true,
            },
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Calculate delay
        const scheduledTime = new Date(data.scheduledAt)
        const delay = Math.max(0, scheduledTime.getTime() - Date.now())

        if (delay === 0) {
            return NextResponse.json(
                { error: 'Scheduled time must be in the future' },
                { status: 400 }
            )
        }

        // Add to queue
        const queue = getScheduledMessageQueue()
        const job = await queue.add(
            'send-scheduled-message',
            {
                conversationId: data.conversationId,
                contactId: conversation.contactId,
                channelId: conversation.channelId,
                organizationId: dbUser.organizationId,
                createdBy: dbUser.id,
                type: data.type,
                content: data.content,
                mediaUrl: data.mediaUrl,
                mediaCaption: data.mediaCaption,
                templateId: data.templateId,
                templateParams: data.templateParams,
            },
            {
                delay,
                jobId: `scheduled-${data.conversationId}-${Date.now()}`,
            }
        )

        return NextResponse.json({
            data: {
                id: job.id,
                conversationId: data.conversationId,
                scheduledAt: data.scheduledAt,
                status: 'scheduled',
            },
        })
    } catch (error) {
        console.error('Error scheduling message:', error)
        return NextResponse.json(
            { error: 'Failed to schedule message' },
            { status: 500 }
        )
    }
}

// DELETE - Cancel a scheduled message
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { supabaseUserId: user.id },
            select: { id: true, organizationId: true },
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const jobId = searchParams.get('jobId')

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
        }

        const queue = getScheduledMessageQueue()
        const job = await queue.getJob(jobId)

        if (!job) {
            return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
        }

        // Verify job belongs to user's organization
        const jobData = job.data as Record<string, unknown>
        if (jobData.organizationId !== dbUser.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        await job.remove()

        return NextResponse.json({
            data: { id: jobId, status: 'cancelled' },
        })
    } catch (error) {
        console.error('Error cancelling scheduled message:', error)
        return NextResponse.json(
            { error: 'Failed to cancel scheduled message' },
            { status: 500 }
        )
    }
}
