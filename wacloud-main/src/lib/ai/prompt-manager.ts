import { Redis } from 'ioredis'
import { createHash } from 'crypto'

// Prompt template types
export interface PromptTemplate {
    id: string
    name: string
    description: string
    template: string
    variables: string[]
    category: 'chatbot' | 'deals' | 'contacts' | 'inbox' | 'campaigns' | 'analytics' | 'general'
    model?: string
    temperature?: number
    maxTokens?: number
    version: number
    createdAt: Date
    updatedAt: Date
}

export interface PromptVariables {
    [key: string]: string | number | boolean | null
}

// Prompt cache configuration
const CACHE_TTL = 3600 // 1 hour
const CACHE_PREFIX = 'prompt:'

// Redis client (lazy initialization)
let redisClient: Redis | null = null

function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    }
    return redisClient
}

// Prompt template storage (in-memory for now, can be moved to database)
const promptTemplates: Map<string, PromptTemplate> = new Map()

/**
 * Register a prompt template
 */
export function registerPrompt(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version'>): string {
    const id = createHash('md5').update(template.name).digest('hex').slice(0, 8)

    const prompt: PromptTemplate = {
        ...template,
        id,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    promptTemplates.set(id, prompt)
    return id
}

/**
 * Get a prompt template by ID
 */
export function getPromptTemplate(id: string): PromptTemplate | null {
    return promptTemplates.get(id) || null
}

/**
 * Get all prompt templates by category
 */
export function getPromptsByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(promptTemplates.values()).filter(p => p.category === category)
}

/**
 * Render a prompt template with variables
 */
export function renderPrompt(templateId: string, variables: PromptVariables): string {
    const template = getPromptTemplate(templateId)
    if (!template) {
        throw new Error(`Prompt template not found: ${templateId}`)
    }

    let rendered = template.template

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        rendered = rendered.replace(placeholder, String(value ?? ''))
    }

    // Check for missing variables
    const missingVars = template.variables.filter(v => !(v in variables))
    if (missingVars.length > 0) {
        console.warn(`Missing variables in prompt ${templateId}:`, missingVars)
    }

    return rendered
}

/**
 * Cache a prompt response
 */
export async function cachePromptResponse(
    promptId: string,
    variables: PromptVariables,
    response: string
): Promise<void> {
    const redis = getRedisClient()
    const cacheKey = generateCacheKey(promptId, variables)
    await redis.setex(cacheKey, CACHE_TTL, response)
}

/**
 * Get cached prompt response
 */
export async function getCachedPromptResponse(
    promptId: string,
    variables: PromptVariables
): Promise<string | null> {
    const redis = getRedisClient()
    const cacheKey = generateCacheKey(promptId, variables)
    return redis.get(cacheKey)
}

/**
 * Generate cache key from prompt ID and variables
 */
function generateCacheKey(promptId: string, variables: PromptVariables): string {
    const varsHash = createHash('md5')
        .update(JSON.stringify(variables))
        .digest('hex')
    return `${CACHE_PREFIX}${promptId}:${varsHash}`
}

/**
 * Clear prompt cache
 */
export async function clearPromptCache(promptId?: string): Promise<void> {
    const redis = getRedisClient()
    const pattern = promptId ? `${CACHE_PREFIX}${promptId}:*` : `${CACHE_PREFIX}*`

    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
        await redis.del(...keys)
    }
}

// ============================================
// Pre-defined Prompt Templates
// ============================================

// Chatbot prompts
registerPrompt({
    name: 'chatbot_response',
    description: 'Generate chatbot response based on conversation context',
    template: `You are a helpful WhatsApp chatbot assistant for {{businessName}}.

Conversation context:
{{conversationHistory}}

User message: {{userMessage}}

Generate a helpful, concise response that:
1. Addresses the user's question or concern
2. Maintains a {{tone}} tone
3. Stays within {{maxLength}} characters
4. Uses emojis sparingly and appropriately

Response:`,
    variables: ['businessName', 'conversationHistory', 'userMessage', 'tone', 'maxLength'],
    category: 'chatbot',
    temperature: 0.7,
    maxTokens: 500,
})

registerPrompt({
    name: 'intent_detection',
    description: 'Detect user intent from message',
    template: `Analyze the following message and determine the user's intent.

Message: {{message}}

Possible intents:
- question: User is asking a question
- complaint: User has a complaint or issue
- purchase: User wants to buy something
- support: User needs technical support
- feedback: User is providing feedback
- greeting: User is greeting
- other: None of the above

Return ONLY the intent name, nothing else.`,
    variables: ['message'],
    category: 'chatbot',
    temperature: 0.3,
    maxTokens: 50,
})

// Deals prompts
registerPrompt({
    name: 'lead_scoring',
    description: 'Calculate lead score based on conversation and profile',
    template: `Analyze this lead and provide a score from 0-100.

Contact information:
- Name: {{contactName}}
- Company: {{company}}
- Role: {{role}}

Conversation summary:
{{conversationSummary}}

Engagement metrics:
- Messages sent: {{messageCount}}
- Response rate: {{responseRate}}%
- Last contacted: {{lastContacted}}

Consider:
1. Engagement level
2. Buying signals
3. Company fit
4. Role/decision-making power
5. Timeline indicators

Provide:
1. Score (0-100)
2. Brief reasoning (2-3 sentences)
3. Recommended next action

Format as JSON:
{
  "score": number,
  "reasoning": "string",
  "nextAction": "string"
}`,
    variables: ['contactName', 'company', 'role', 'conversationSummary', 'messageCount', 'responseRate', 'lastContacted'],
    category: 'deals',
    temperature: 0.5,
    maxTokens: 300,
})

registerPrompt({
    name: 'deal_summary',
    description: 'Generate deal summary from conversations',
    template: `Summarize this deal based on the conversation history.

Deal: {{dealName}}
Contact: {{contactName}}

Conversation history:
{{conversationHistory}}

Generate a concise summary including:
1. Current status and stage
2. Key discussion points
3. Customer needs/pain points
4. Next steps
5. Potential objections or concerns

Keep it under 200 words.`,
    variables: ['dealName', 'contactName', 'conversationHistory'],
    category: 'deals',
    temperature: 0.6,
    maxTokens: 400,
})

// Contact prompts
registerPrompt({
    name: 'contact_enrichment',
    description: 'Extract contact information from conversation',
    template: `Extract contact information from this conversation.

Conversation:
{{conversation}}

Extract and return as JSON:
{
  "name": "full name if mentioned",
  "company": "company name if mentioned",
  "role": "job title if mentioned",
  "email": "email if mentioned",
  "phone": "phone number if mentioned",
  "location": "city/country if mentioned",
  "interests": ["list", "of", "interests"],
  "painPoints": ["list", "of", "pain", "points"]
}

Only include fields that are explicitly mentioned. Use null for missing fields.`,
    variables: ['conversation'],
    category: 'contacts',
    temperature: 0.3,
    maxTokens: 300,
})

// Inbox prompts
registerPrompt({
    name: 'smart_reply',
    description: 'Generate smart reply suggestions',
    template: `Generate 3 quick reply suggestions for this message.

Conversation context:
{{conversationContext}}

Latest message: {{latestMessage}}

Generate 3 different replies:
1. A brief acknowledgment (1 sentence)
2. A helpful response (2-3 sentences)
3. A question to gather more info (1 sentence)

Format as JSON array:
[
  {"text": "reply 1", "type": "acknowledgment"},
  {"text": "reply 2", "type": "helpful"},
  {"text": "reply 3", "type": "question"}
]`,
    variables: ['conversationContext', 'latestMessage'],
    category: 'inbox',
    temperature: 0.7,
    maxTokens: 300,
})

registerPrompt({
    name: 'sentiment_analysis',
    description: 'Analyze message sentiment',
    template: `Analyze the sentiment of this message.

Message: {{message}}

Return as JSON:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 0.0 to 1.0,
  "emotions": ["happy", "frustrated", "curious", etc.],
  "urgency": "low" | "medium" | "high"
}`,
    variables: ['message'],
    category: 'inbox',
    temperature: 0.2,
    maxTokens: 150,
})

// Campaign prompts
registerPrompt({
    name: 'campaign_content',
    description: 'Generate campaign message content',
    template: `Create a WhatsApp campaign message for {{campaignType}}.

Target audience: {{targetAudience}}
Goal: {{campaignGoal}}
Tone: {{tone}}
Key message: {{keyMessage}}

Requirements:
- Keep it under {{maxLength}} characters
- Include a clear call-to-action
- Make it engaging and personal
- Use appropriate emojis (max 3)

Generate the message:`,
    variables: ['campaignType', 'targetAudience', 'campaignGoal', 'tone', 'keyMessage', 'maxLength'],
    category: 'campaigns',
    temperature: 0.8,
    maxTokens: 300,
})

// Analytics prompts
registerPrompt({
    name: 'insight_generation',
    description: 'Generate insights from analytics data',
    template: `Analyze this data and provide actionable insights.

Metrics:
{{metricsData}}

Time period: {{timePeriod}}

Provide:
1. Top 3 key findings
2. Trends or patterns
3. 2-3 actionable recommendations
4. Potential concerns or risks

Keep it concise and business-focused.`,
    variables: ['metricsData', 'timePeriod'],
    category: 'analytics',
    temperature: 0.5,
    maxTokens: 500,
})

// Export all registered prompts for reference
export function getAllPrompts(): PromptTemplate[] {
    return Array.from(promptTemplates.values())
}
