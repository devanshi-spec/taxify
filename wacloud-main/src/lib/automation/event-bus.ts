import { Queue, Worker, QueueEvents } from 'bullmq'
import { AutomationEvent } from './types'
import Redis from 'ioredis'

// Redis connection string is required
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Create a singleton connection for reuse
let redisConnection: Redis | null = null

function getRedisConnection() {
    if (!redisConnection) {
        redisConnection = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
        })
    }
    return redisConnection
}

// Queue name
const AUTOMATION_QUEUE = 'automation-events'

// Singleton Queue instance
let eventQueue: Queue | null = null

export function getEventQueue() {
    if (!eventQueue) {
        eventQueue = new Queue(AUTOMATION_QUEUE, {
            connection: getRedisConnection(),
        })
    }
    return eventQueue
}

/**
 * Publish an event to the automation system
 */
export async function publishEvent(event: Omit<AutomationEvent, 'id' | 'timestamp'>) {
    const queue = getEventQueue()

    const fullEvent: AutomationEvent = {
        ...event,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    }

    await queue.add(event.type, fullEvent, {
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs for inspection
    })

    return fullEvent
}

/**
 * Worker setup (should be run in a separate process or instrumentation file)
 * For Next.js, this might need to be in an API route or separate worker script
 */
export function setupWorker() {
    const connection = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
    })

    const worker = new Worker(AUTOMATION_QUEUE, async (job) => {
        const event = job.data as AutomationEvent
        console.log(`Processing event: ${event.type}`, event.id)

        try {
            // Import dynamically to avoid circular dependencies during init
            const { prisma } = await import('@/lib/db')
            const { executeAction } = await import('./actions')

            // 1. Find matching rules
            const rules = await prisma.automationRule.findMany({
                where: {
                    organizationId: event.organizationId,
                    isActive: true,
                    triggerType: event.type,
                }
            })

            console.log(`Found ${rules.length} matching rules for event ${event.type}`)

            // 2. Execute actions for each rule
            for (const rule of rules) {
                // Flow ID matching logic
                if (event.type === 'FLOW_COMPLETED' && rule.triggerConfig) {
                    const config = rule.triggerConfig as any
                    if (config.flowId && config.flowId !== event.data.flowId) {
                        continue
                    }
                }

                await executeAction(
                    rule.actionType as any,
                    rule.actionConfig as any,
                    {
                        organizationId: event.organizationId,
                        contactId: event.data.contactId,
                        variables: event.data.variables
                    }
                )
            }
        } catch (error) {
            console.error('Error processing automation job:', error)
            throw error
        }

        return true
    }, {
        connection,
        concurrency: 5,
    })

    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed!`)
    })

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed with ${err.message}`)
    })

    return worker
}
