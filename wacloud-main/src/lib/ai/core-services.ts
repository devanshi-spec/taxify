import { completeAI, streamAI, type AIModel, type AIMessage } from './enhanced-provider'
import { renderPrompt, getCachedPromptResponse, cachePromptResponse } from './prompt-manager'

// Core AI service functions

/**
 * Sentiment Analysis
 */
export async function analyzeSentiment(text: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral'
    confidence: number
    emotions: string[]
    urgency: 'low' | 'medium' | 'high'
}> {
    const prompt = renderPrompt('sentiment_analysis', { message: text })

    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        responseFormat: 'json',
    })

    return JSON.parse(response.content)
}

/**
 * Intent Detection
 */
export async function detectIntent(message: string): Promise<string> {
    const prompt = renderPrompt('intent_detection', { message })

    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 50,
    })

    return response.content.trim().toLowerCase()
}

/**
 * Entity Extraction
 */
export async function extractEntities(text: string): Promise<{
    name?: string
    company?: string
    role?: string
    email?: string
    phone?: string
    location?: string
    interests?: string[]
    painPoints?: string[]
}> {
    const prompt = renderPrompt('contact_enrichment', { conversation: text })

    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        responseFormat: 'json',
    })

    return JSON.parse(response.content)
}

/**
 * Language Detection
 */
export async function detectLanguage(text: string): Promise<{
    language: string
    confidence: number
}> {
    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: `Detect the language of this text and return as JSON: {"language": "en/es/pt/fr/etc", "confidence": 0.0-1.0}\n\nText: ${text}`
        }],
        temperature: 0.1,
        responseFormat: 'json',
    })

    return JSON.parse(response.content)
}

/**
 * Text Summarization
 */
export async function summarizeText(
    text: string,
    maxLength: number = 200
): Promise<string> {
    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: `Summarize the following text in under ${maxLength} words:\n\n${text}`
        }],
        temperature: 0.5,
        maxTokens: Math.ceil(maxLength * 1.5),
    })

    return response.content
}

/**
 * Content Generation
 */
export async function generateContent(
    prompt: string,
    options: {
        model?: AIModel
        temperature?: number
        maxTokens?: number
        stream?: boolean
    } = {}
): Promise<string | AsyncGenerator<string>> {
    const {
        model = 'gpt-4o',
        temperature = 0.7,
        maxTokens = 1000,
        stream = false,
    } = options

    if (stream) {
        return (async function* () {
            for await (const chunk of streamAI({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                maxTokens,
            })) {
                if (!chunk.done) {
                    yield chunk.content
                }
            }
        })()
    }

    const response = await completeAI({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        maxTokens,
    })

    return response.content
}

/**
 * Smart Reply Suggestions
 */
export async function generateSmartReplies(
    conversationContext: string,
    latestMessage: string
): Promise<Array<{ text: string; type: string }>> {
    const prompt = renderPrompt('smart_reply', {
        conversationContext,
        latestMessage,
    })

    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        responseFormat: 'json',
    })

    return JSON.parse(response.content)
}

/**
 * Lead Scoring
 */
export async function scoreLead(params: {
    contactName: string
    company?: string
    role?: string
    conversationSummary: string
    messageCount: number
    responseRate: number
    lastContacted: string
}): Promise<{
    score: number
    reasoning: string
    nextAction: string
}> {
    const prompt = renderPrompt('lead_scoring', {
        contactName: params.contactName,
        company: params.company || 'Unknown',
        role: params.role || 'Unknown',
        conversationSummary: params.conversationSummary,
        messageCount: params.messageCount,
        responseRate: params.responseRate,
        lastContacted: params.lastContacted,
    })

    const response = await completeAI({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        responseFormat: 'json',
    })

    return JSON.parse(response.content)
}

/**
 * Deal Summary Generation
 */
export async function generateDealSummary(
    dealName: string,
    contactName: string,
    conversationHistory: string
): Promise<string> {
    const prompt = renderPrompt('deal_summary', {
        dealName,
        contactName,
        conversationHistory,
    })

    const response = await completeAI({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
    })

    return response.content
}

/**
 * Campaign Content Generation
 */
export async function generateCampaignContent(params: {
    campaignType: string
    targetAudience: string
    campaignGoal: string
    tone: string
    keyMessage: string
    maxLength: number
}): Promise<string> {
    const prompt = renderPrompt('campaign_content', params)

    const response = await completeAI({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
    })

    return response.content
}

/**
 * Analytics Insights Generation
 */
export async function generateInsights(
    metricsData: string,
    timePeriod: string
): Promise<string> {
    const prompt = renderPrompt('insight_generation', {
        metricsData,
        timePeriod,
    })

    const response = await completeAI({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
    })

    return response.content
}

/**
 * Chatbot Response Generation (with caching)
 */
export async function generateChatbotResponse(params: {
    businessName: string
    conversationHistory: string
    userMessage: string
    tone: string
    maxLength: number
    useCache?: boolean
}): Promise<string> {
    const { useCache = true, ...promptParams } = params

    // Check cache first
    if (useCache) {
        const cached = await getCachedPromptResponse('chatbot_response', promptParams)
        if (cached) {
            return cached
        }
    }

    const prompt = renderPrompt('chatbot_response', promptParams)

    const response = await completeAI({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
    })

    // Cache the response
    if (useCache) {
        await cachePromptResponse('chatbot_response', promptParams, response.content)
    }

    return response.content
}

/**
 * Tone Adjustment
 */
export async function adjustTone(
    text: string,
    targetTone: 'formal' | 'friendly' | 'urgent' | 'professional' | 'casual'
): Promise<string> {
    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: `Rewrite the following message in a ${targetTone} tone while keeping the same meaning:\n\n${text}`
        }],
        temperature: 0.6,
    })

    return response.content
}

/**
 * Grammar and Spelling Correction
 */
export async function correctGrammar(text: string): Promise<string> {
    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: `Fix any grammar and spelling errors in this text. Return ONLY the corrected text:\n\n${text}`
        }],
        temperature: 0.3,
    })

    return response.content
}

/**
 * Translation
 */
export async function translateText(
    text: string,
    targetLanguage: string
): Promise<string> {
    const response = await completeAI({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: `Translate the following text to ${targetLanguage}. Return ONLY the translation:\n\n${text}`
        }],
        temperature: 0.3,
    })

    return response.content
}
