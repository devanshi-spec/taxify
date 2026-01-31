import Redis from 'ioredis'

// Redis connection for BullMQ
// Uses lazy initialization for serverless compatibility
let redisConnection: Redis | null = null

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retries reached, giving up')
          return null
        }
        return Math.min(times * 200, 2000)
      },
    })

    redisConnection.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redisConnection.on('connect', () => {
      console.log('[Redis] Connected successfully')
    })
  }

  return redisConnection
}

// For graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit()
    redisConnection = null
  }
}
