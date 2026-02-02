import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export type AIProvider = 'openai' | 'anthropic'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface AICompletionResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  model: string
  provider: AIProvider
}

export interface AIProviderClient {
  chat(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResponse>
  streamChat(
    messages: AIMessage[],
    options?: AICompletionOptions,
    onChunk?: (chunk: string) => void
  ): Promise<AICompletionResponse>
}

// OpenAI Implementation
class OpenAIClient implements AIProviderClient {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async chat(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResponse> {
    const model = options?.model || 'gpt-4o'

    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1000,
    })

    return {
      content: response.choices[0]?.message?.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      model,
      provider: 'openai',
    }
  }

  async streamChat(
    messages: AIMessage[],
    options?: AICompletionOptions,
    onChunk?: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    const model = options?.model || 'gpt-4o'

    const stream = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1000,
      stream: true,
    })

    let content = ''
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      content += text
      onChunk?.(text)
    }

    return {
      content,
      model,
      provider: 'openai',
    }
  }
}

// Anthropic Implementation
class AnthropicClient implements AIProviderClient {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async chat(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResponse> {
    const model = options?.model || 'claude-sonnet-4-20250514'

    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 1000,
      system: systemMessage?.content || options?.systemPrompt,
      messages: conversationMessages,
    })

    const textContent = response.content.find((c) => c.type === 'text')

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model,
      provider: 'anthropic',
    }
  }

  async streamChat(
    messages: AIMessage[],
    options?: AICompletionOptions,
    onChunk?: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    const model = options?.model || 'claude-sonnet-4-20250514'

    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const stream = await this.client.messages.stream({
      model,
      max_tokens: options?.maxTokens ?? 1000,
      system: systemMessage?.content || options?.systemPrompt,
      messages: conversationMessages,
    })

    let content = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta
        if ('text' in delta) {
          content += delta.text
          onChunk?.(delta.text)
        }
      }
    }

    return {
      content,
      model,
      provider: 'anthropic',
    }
  }
}

// Factory function
export function createAIClient(provider: AIProvider, apiKey: string): AIProviderClient {
  switch (provider) {
    case 'openai':
      return new OpenAIClient(apiKey)
    case 'anthropic':
      return new AnthropicClient(apiKey)
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

// Multi-provider manager
export class AIManager {
  private clients: Map<AIProvider, AIProviderClient> = new Map()
  private defaultProvider: AIProvider

  constructor(defaultProvider: AIProvider = 'openai') {
    this.defaultProvider = defaultProvider
  }

  registerProvider(provider: AIProvider, apiKey: string): void {
    this.clients.set(provider, createAIClient(provider, apiKey))
  }

  setDefaultProvider(provider: AIProvider): void {
    if (!this.clients.has(provider)) {
      throw new Error(`Provider ${provider} not registered`)
    }
    this.defaultProvider = provider
  }

  getClient(provider?: AIProvider): AIProviderClient {
    const targetProvider = provider || this.defaultProvider
    const client = this.clients.get(targetProvider)
    if (!client) {
      throw new Error(`Provider ${targetProvider} not registered`)
    }
    return client
  }

  async chat(
    messages: AIMessage[],
    options?: AICompletionOptions & { provider?: AIProvider },
    trackingContext?: {
      organizationId: string
      userId?: string
      feature: string
    }
  ): Promise<AICompletionResponse> {
    const client = this.getClient(options?.provider)
    const provider = options?.provider || this.defaultProvider

    // Track usage if context provided
    if (trackingContext) {
      const { logAIUsage } = await import('./monitoring')
      const startTime = Date.now()

      try {
        const response = await client.chat(messages, options)
        const latency = Date.now() - startTime

        // Log successful usage
        if (response.usage) {
          await logAIUsage({
            organizationId: trackingContext.organizationId,
            userId: trackingContext.userId,
            provider,
            model: response.model as any,
            promptTokens: response.usage.inputTokens,
            completionTokens: response.usage.outputTokens,
            feature: trackingContext.feature,
            success: true,
            latency,
          })
        }

        return response
      } catch (error) {
        const latency = Date.now() - startTime

        // Log error
        await logAIUsage({
          organizationId: trackingContext.organizationId,
          userId: trackingContext.userId,
          provider,
          model: options?.model || 'unknown' as any,
          promptTokens: 0,
          completionTokens: 0,
          feature: trackingContext.feature,
          success: false,
          latency,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        throw error
      }
    }

    // No tracking - direct call
    return client.chat(messages, options)
  }

  async streamChat(
    messages: AIMessage[],
    options?: AICompletionOptions & { provider?: AIProvider },
    onChunk?: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    const client = this.getClient(options?.provider)
    return client.streamChat(messages, options, onChunk)
  }
}

// Default manager instance
let aiManager: AIManager | null = null

export function getAIManager(): AIManager {
  if (!aiManager) {
    aiManager = new AIManager('openai')

    if (process.env.OPENAI_API_KEY) {
      aiManager.registerProvider('openai', process.env.OPENAI_API_KEY)
    }
    if (process.env.ANTHROPIC_API_KEY) {
      aiManager.registerProvider('anthropic', process.env.ANTHROPIC_API_KEY)
    }
  }
  return aiManager
}
