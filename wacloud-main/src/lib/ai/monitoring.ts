import { prisma } from '@/lib/db'
import type { AIModel } from './enhanced-provider'

// AI usage tracking
export interface AIUsageLog {
    id: string
    organizationId: string
    userId?: string
    provider: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
    feature: string
    success: boolean
    latency: number
    error?: string
    createdAt: Date
}

// Cost per 1M tokens (approximate, update based on current pricing)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
}

/**
 * Calculate cost for AI usage
 */
export function calculateCost(
    model: AIModel,
    promptTokens: number,
    completionTokens: number
): number {
    const costs = MODEL_COSTS[model] || { input: 0, output: 0 }
    const inputCost = (promptTokens / 1_000_000) * costs.input
    const outputCost = (completionTokens / 1_000_000) * costs.output
    return inputCost + outputCost
}

/**
 * Log AI usage
 */
export async function logAIUsage(params: {
    organizationId: string
    userId?: string
    provider: string
    model: AIModel
    promptTokens: number
    completionTokens: number
    feature: string
    success: boolean
    latency: number
    error?: string
}): Promise<void> {
    const totalTokens = params.promptTokens + params.completionTokens
    const cost = calculateCost(params.model, params.promptTokens, params.completionTokens)

    try {
        await prisma.aIUsageLog.create({
            data: {
                organizationId: params.organizationId,
                userId: params.userId,
                provider: params.provider,
                model: params.model,
                promptTokens: params.promptTokens,
                completionTokens: params.completionTokens,
                totalTokens,
                cost,
                feature: params.feature,
                success: params.success,
                latency: params.latency,
                error: params.error,
            },
        })
    } catch (error) {
        console.error('Failed to log AI usage:', error)
    }
}

/**
 * Get AI usage stats for organization
 */
export async function getAIUsageStats(
    organizationId: string,
    startDate: Date,
    endDate: Date
): Promise<{
    totalCost: number
    totalTokens: number
    requestCount: number
    successRate: number
    avgLatency: number
    byModel: Record<string, { cost: number; tokens: number; requests: number }>
    byFeature: Record<string, { cost: number; tokens: number; requests: number }>
}> {
    const logs = await prisma.aIUsageLog.findMany({
        where: {
            organizationId,
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        },
    })

    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0)
    const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0)
    const requestCount = logs.length
    const successCount = logs.filter(log => log.success).length
    const successRate = requestCount > 0 ? (successCount / requestCount) * 100 : 0
    const avgLatency = requestCount > 0
        ? logs.reduce((sum, log) => sum + log.latency, 0) / requestCount
        : 0

    // Group by model
    const byModel: Record<string, { cost: number; tokens: number; requests: number }> = {}
    logs.forEach(log => {
        if (!byModel[log.model]) {
            byModel[log.model] = { cost: 0, tokens: 0, requests: 0 }
        }
        byModel[log.model].cost += log.cost
        byModel[log.model].tokens += log.totalTokens
        byModel[log.model].requests += 1
    })

    // Group by feature
    const byFeature: Record<string, { cost: number; tokens: number; requests: number }> = {}
    logs.forEach(log => {
        if (!byFeature[log.feature]) {
            byFeature[log.feature] = { cost: 0, tokens: 0, requests: 0 }
        }
        byFeature[log.feature].cost += log.cost
        byFeature[log.feature].tokens += log.totalTokens
        byFeature[log.feature].requests += 1
    })

    return {
        totalCost,
        totalTokens,
        requestCount,
        successRate,
        avgLatency,
        byModel,
        byFeature,
    }
}

/**
 * AI performance monitoring
 */
export class AIMonitor {
    private startTime: number
    private organizationId: string
    private userId?: string
    private feature: string
    private model: AIModel
    private provider: string

    constructor(params: {
        organizationId: string
        userId?: string
        feature: string
        model: AIModel
        provider: string
    }) {
        this.startTime = Date.now()
        this.organizationId = params.organizationId
        this.userId = params.userId
        this.feature = params.feature
        this.model = params.model
        this.provider = params.provider
    }

    async logSuccess(promptTokens: number, completionTokens: number): Promise<void> {
        const latency = Date.now() - this.startTime

        await logAIUsage({
            organizationId: this.organizationId,
            userId: this.userId,
            provider: this.provider,
            model: this.model,
            promptTokens,
            completionTokens,
            feature: this.feature,
            success: true,
            latency,
        })
    }

    async logError(error: Error): Promise<void> {
        const latency = Date.now() - this.startTime

        await logAIUsage({
            organizationId: this.organizationId,
            userId: this.userId,
            provider: this.provider,
            model: this.model,
            promptTokens: 0,
            completionTokens: 0,
            feature: this.feature,
            success: false,
            latency,
            error: error.message,
        })
    }
}

/**
 * Check if organization has exceeded AI budget
 */
export async function checkAIBudget(
    organizationId: string,
    monthlyBudget: number
): Promise<{
    withinBudget: boolean
    currentSpend: number
    remainingBudget: number
    percentageUsed: number
}> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const endOfMonth = new Date()
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)
    endOfMonth.setDate(0)
    endOfMonth.setHours(23, 59, 59, 999)

    const stats = await getAIUsageStats(organizationId, startOfMonth, endOfMonth)

    const currentSpend = stats.totalCost
    const remainingBudget = monthlyBudget - currentSpend
    const percentageUsed = (currentSpend / monthlyBudget) * 100

    return {
        withinBudget: currentSpend <= monthlyBudget,
        currentSpend,
        remainingBudget,
        percentageUsed,
    }
}

/**
 * Get AI usage trends
 */
export async function getAIUsageTrends(
    organizationId: string,
    days: number = 30
): Promise<Array<{
    date: string
    cost: number
    tokens: number
    requests: number
}>> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const logs = await prisma.aIUsageLog.findMany({
        where: {
            organizationId,
            createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'asc' },
    })

    // Group by date
    const byDate: Record<string, { cost: number; tokens: number; requests: number }> = {}

    logs.forEach(log => {
        const date = log.createdAt.toISOString().split('T')[0]
        if (!byDate[date]) {
            byDate[date] = { cost: 0, tokens: 0, requests: 0 }
        }
        byDate[date].cost += log.cost
        byDate[date].tokens += log.totalTokens
        byDate[date].requests += 1
    })

    return Object.entries(byDate).map(([date, stats]) => ({
        date,
        ...stats,
    }))
}
