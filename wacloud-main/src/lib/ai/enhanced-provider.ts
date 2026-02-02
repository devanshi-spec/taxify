import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// AI Provider Types
export type AIProvider = 'openai' | 'anthropic' | 'google'
export type AIModel =
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gpt-4-turbo'
    | 'claude-3-5-sonnet-20241022'
    | 'claude-3-opus-20240229'
    | 'claude-3-haiku-20240307'
    | 'gemini-pro'
    | 'gemini-1.5-pro'

export interface AIMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface AICompletionOptions {
    model: AIModel
    messages: AIMessage[]
    temperature?: number
    maxTokens?: number
    stream?: boolean
    functions?: AIFunction[]
    responseFormat?: 'text' | 'json'
}

export interface AIFunction {
    name: string
    description: string
    parameters: Record<string, unknown>
}

export interface AICompletionResponse {
    content: string
    usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
    finishReason?: string
    functionCall?: {
        name: string
        arguments: string
    }
}

export interface AIStreamChunk {
    content: string
    done: boolean
}

// Enhanced AI Service Interface
export interface IAIService {
    complete(options: AICompletionOptions): Promise<AICompletionResponse>
    stream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk>
    embed(text: string): Promise<number[]>
    moderate(text: string): Promise<{ flagged: boolean; categories: string[] }>
    transcribe(file: any): Promise<string>
}

// OpenAI Service Implementation
export class OpenAIService implements IAIService {
    private client: OpenAI

    constructor(apiKey?: string) {
        this.client = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        })
    }

    async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
        const response = await this.client.chat.completions.create({
            model: options.model,
            messages: options.messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
            response_format: options.responseFormat === 'json'
                ? { type: 'json_object' }
                : undefined,
            functions: options.functions?.map(f => ({
                name: f.name,
                description: f.description,
                parameters: f.parameters,
            })),
        })

        const choice = response.choices[0]

        return {
            content: choice.message.content || '',
            usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            } : undefined,
            finishReason: choice.finish_reason,
            functionCall: choice.message.function_call ? {
                name: choice.message.function_call.name,
                arguments: choice.message.function_call.arguments,
            } : undefined,
        }
    }

    async *stream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
        const stream = await this.client.chat.completions.create({
            model: options.model,
            messages: options.messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
            stream: true,
        })

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            const done = chunk.choices[0]?.finish_reason !== null

            yield { content, done }
        }
    }

    async embed(text: string): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        })

        return response.data[0].embedding
    }

    async moderate(text: string): Promise<{ flagged: boolean; categories: string[] }> {
        const response = await this.client.moderations.create({
            input: text,
        })

        const result = response.results[0]
        const flaggedCategories = Object.entries(result.categories)
            .filter(([_, flagged]) => flagged)
            .map(([category]) => category)

        return {
            flagged: result.flagged,
            categories: flaggedCategories,
        }
    }

    async transcribe(file: any): Promise<string> {
        const response = await this.client.audio.transcriptions.create({
            file: file,
            model: "whisper-1",
        });
        return response.text;
    }
}

// Anthropic Service Implementation
export class AnthropicService implements IAIService {
    private client: Anthropic

    constructor(apiKey?: string) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        })
    }

    async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
        const systemMessage = options.messages.find(m => m.role === 'system')
        const messages = options.messages.filter(m => m.role !== 'system')

        const response = await this.client.messages.create({
            model: options.model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            system: systemMessage?.content,
            messages: messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            })),
        })

        const content = response.content[0]

        return {
            content: content.type === 'text' ? content.text : '',
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
            finishReason: response.stop_reason || undefined,
        }
    }

    async *stream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
        const systemMessage = options.messages.find(m => m.role === 'system')
        const messages = options.messages.filter(m => m.role !== 'system')

        const stream = await this.client.messages.create({
            model: options.model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            system: systemMessage?.content,
            messages: messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            })),
            stream: true,
        })

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield {
                    content: event.delta.text,
                    done: false,
                }
            } else if (event.type === 'message_stop') {
                yield {
                    content: '',
                    done: true,
                }
            }
        }
    }

    async embed(text: string): Promise<number[]> {
        // Anthropic doesn't have native embeddings, use OpenAI as fallback
        const openai = new OpenAIService()
        return openai.embed(text)
    }

    async moderate(text: string): Promise<{ flagged: boolean; categories: string[] }> {
        // Use OpenAI moderation as fallback
        const openai = new OpenAIService()
        return openai.moderate(text)
    }

    async transcribe(file: any): Promise<string> {
        // Anthropic does not support transcription, fallback to OpenAI
        const openai = new OpenAIService()
        return openai.transcribe(file)
    }
}

// Google AI Service Implementation
export class GoogleAIService implements IAIService {
    private client: GoogleGenerativeAI

    constructor(apiKey?: string) {
        this.client = new GoogleGenerativeAI(apiKey || process.env.GOOGLE_AI_API_KEY || '')
    }

    async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
        const model = this.client.getGenerativeModel({ model: options.model })

        const systemMessage = options.messages.find(m => m.role === 'system')
        const messages = options.messages.filter(m => m.role !== 'system')

        const chat = model.startChat({
            history: messages.slice(0, -1).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }],
            })),
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
            },
        })

        const lastMessage = messages[messages.length - 1]
        const prompt = systemMessage
            ? `${systemMessage.content}\n\n${lastMessage.content}`
            : lastMessage.content

        const result = await chat.sendMessage(prompt)
        const response = result.response

        return {
            content: response.text(),
            usage: response.usageMetadata ? {
                promptTokens: response.usageMetadata.promptTokenCount || 0,
                completionTokens: response.usageMetadata.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata.totalTokenCount || 0,
            } : undefined,
        }
    }

    async *stream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
        const model = this.client.getGenerativeModel({ model: options.model })

        const systemMessage = options.messages.find(m => m.role === 'system')
        const messages = options.messages.filter(m => m.role !== 'system')

        const chat = model.startChat({
            history: messages.slice(0, -1).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }],
            })),
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
            },
        })

        const lastMessage = messages[messages.length - 1]
        const prompt = systemMessage
            ? `${systemMessage.content}\n\n${lastMessage.content}`
            : lastMessage.content

        const result = await chat.sendMessageStream(prompt)

        for await (const chunk of result.stream) {
            yield {
                content: chunk.text(),
                done: false,
            }
        }

        yield { content: '', done: true }
    }

    async embed(text: string): Promise<number[]> {
        const model = this.client.getGenerativeModel({ model: 'embedding-001' })
        const result = await model.embedContent(text)
        return result.embedding.values
    }

    async moderate(text: string): Promise<{ flagged: boolean; categories: string[] }> {
        // Use OpenAI moderation as fallback
        const openai = new OpenAIService()
        return openai.moderate(text)
    }

    async transcribe(file: any): Promise<string> {
        // Google does not natively support simple transcription in this SDK version, fallback to OpenAI
        const openai = new OpenAIService()
        return openai.transcribe(file)
    }
}

// AI Service Factory
export function createAIService(provider: AIProvider, apiKey?: string): IAIService {
    switch (provider) {
        case 'openai':
            return new OpenAIService(apiKey)
        case 'anthropic':
            return new AnthropicService(apiKey)
        case 'google':
            return new GoogleAIService(apiKey)
        default:
            throw new Error(`Unknown AI provider: ${provider}`)
    }
}

// Helper to get provider from model
export function getProviderFromModel(model: AIModel): AIProvider {
    if (model.startsWith('gpt-')) return 'openai'
    if (model.startsWith('claude-')) return 'anthropic'
    if (model.startsWith('gemini-')) return 'google'
    throw new Error(`Unknown model: ${model}`)
}

// Unified AI completion function with usage tracking
export async function completeAI(
    options: AICompletionOptions,
    context?: {
        organizationId: string
        userId?: string
        feature: string
    }
): Promise<AICompletionResponse> {
    const provider = getProviderFromModel(options.model)
    const service = createAIService(provider)

    // Track usage if context provided
    if (context) {
        const { AIMonitor } = await import('./monitoring')
        const monitor = new AIMonitor({
            organizationId: context.organizationId,
            userId: context.userId,
            feature: context.feature,
            model: options.model,
            provider,
        })

        try {
            const response = await service.complete(options)

            // Log successful usage
            if (response.usage) {
                await monitor.logSuccess(
                    response.usage.promptTokens,
                    response.usage.completionTokens
                )
            }

            return response
        } catch (error) {
            // Log error
            await monitor.logError(error as Error)
            throw error
        }
    }

    // No tracking - direct call
    return service.complete(options)
}

// Unified AI streaming function
export async function* streamAI(
    options: AICompletionOptions
): AsyncGenerator<AIStreamChunk> {
    const provider = getProviderFromModel(options.model)
    const service = createAIService(provider)
    yield* service.stream(options)
}
