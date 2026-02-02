import { prisma } from '@/lib/db'
import { getAIManager, type AIMessage } from '@/lib/ai/provider'
import type { Message, Conversation, Contact, Channel, Chatbot } from '@prisma/client'

// ============================================
// TYPES
// ============================================

interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

interface FlowState {
  currentNodeId: string | null
  variables: Record<string, unknown>
  waitingForInput: boolean
  inputType: 'text' | 'buttons' | 'list' | null
  expectedOptions?: string[]
  lastExecutedAt: string
}

interface FlowContext {
  chatbot: Chatbot
  conversation: Conversation & { contact: Contact; channel: Channel }
  flowData: FlowData
  flowState: FlowState
  incomingMessage: Message
}

interface ExecutionResult {
  responses: string[]
  mediaMessages: Array<{ type: string; url: string; caption?: string }>
  templateMessages: Array<{ templateId: string; params: Record<string, string> }>
  newState: FlowState
  handoff: boolean
  completed: boolean
}

// ============================================
// FLOW EXECUTOR CLASS
// ============================================

export class FlowExecutor {
  private context: FlowContext

  constructor(context: FlowContext) {
    this.context = context
  }

  /**
   * Execute the flow based on incoming message
   */
  async execute(): Promise<ExecutionResult> {
    const result: ExecutionResult = {
      responses: [],
      mediaMessages: [],
      templateMessages: [],
      newState: { ...this.context.flowState },
      handoff: false,
      completed: false,
    }

    try {
      const { flowData, flowState, incomingMessage } = this.context
      const messageContent = incomingMessage.content?.trim() || ''

      // If waiting for input, process the response first
      if (flowState.waitingForInput && flowState.currentNodeId) {
        const currentNode = this.getNode(flowState.currentNodeId)
        if (currentNode?.type === 'question') {
          // Validate input if buttons/list
          if (flowState.inputType === 'buttons' || flowState.inputType === 'list') {
            const options = flowState.expectedOptions || []
            const matchedOption = options.find(
              (opt) => opt.toLowerCase() === messageContent.toLowerCase()
            )
            if (matchedOption) {
              result.newState.variables[currentNode.data.variable as string] = matchedOption
            } else {
              // Invalid option, ask again
              result.responses.push(
                `Please select a valid option: ${options.join(', ')}`
              )
              return result
            }
          } else {
            // Free text - store directly
            const varName = (currentNode.data.variable as string) || 'user_input'
            result.newState.variables[varName] = messageContent
          }

          result.newState.waitingForInput = false
          result.newState.inputType = null
          result.newState.expectedOptions = undefined

          // Move to next node
          const nextNodeId = this.getNextNode(flowState.currentNodeId)
          result.newState.currentNodeId = nextNodeId
        }
      }

      // If no current node, start from beginning
      if (!result.newState.currentNodeId) {
        const startNode = flowData.nodes.find((n) => n.type === 'start')
        if (!startNode) {
          console.error('[FlowExecutor] No start node found')
          result.completed = true
          return result
        }
        result.newState.currentNodeId = this.getNextNode(startNode.id)
      }

      // Execute nodes until we need to wait or complete
      let iterations = 0
      const maxIterations = 50 // Prevent infinite loops

      while (result.newState.currentNodeId && iterations < maxIterations) {
        iterations++
        const currentNode = this.getNode(result.newState.currentNodeId)

        if (!currentNode) {
          console.error('[FlowExecutor] Node not found:', result.newState.currentNodeId)
          result.completed = true
          break
        }

        const nodeResult = await this.executeNode(currentNode, result)

        if (nodeResult.stop) {
          break
        }

        if (nodeResult.nextNodeId) {
          result.newState.currentNodeId = nodeResult.nextNodeId
        } else {
          // No next node - flow completed
          result.completed = true
          result.newState.currentNodeId = null
          break
        }
      }

      result.newState.lastExecutedAt = new Date().toISOString()

      if (result.completed) {
        // Publish flow completion event
        try {
          const { publishEvent } = await import('@/lib/automation/event-bus')
          await publishEvent({
            type: 'FLOW_COMPLETED',
            organizationId: this.context.chatbot.organizationId,
            data: {
              flowId: this.context.flowData.nodes[0]?.id || 'unknown', // Ideally pass flowId in context
              contactId: this.context.conversation.contactId,
              variables: result.newState.variables,
            },
          })
          console.log('[FlowExecutor] Published FLOW_COMPLETED event')
        } catch (err) {
          console.error('[FlowExecutor] Failed to publish event:', err)
        }
      }

      return result
    } catch (error) {
      console.error('[FlowExecutor] Execution error:', error)
      result.completed = true
      return result
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: FlowNode,
    result: ExecutionResult
  ): Promise<{ stop: boolean; nextNodeId: string | null }> {
    console.log(`[FlowExecutor] Executing node: ${node.type} (${node.id})`)

    switch (node.type) {
      case 'start':
        return { stop: false, nextNodeId: this.getNextNode(node.id) }

      case 'message':
        return this.executeMessageNode(node, result)

      case 'question':
        return this.executeQuestionNode(node, result)

      case 'condition':
        return this.executeConditionNode(node, result)

      case 'action':
        return this.executeActionNode(node, result)

      case 'delay':
        return this.executeDelayNode(node, result)

      case 'ai':
        return this.executeAINode(node, result)

      case 'media':
        return this.executeMediaNode(node, result)

      case 'template':
        return this.executeTemplateNode(node, result)

      default:
        console.warn(`[FlowExecutor] Unknown node type: ${node.type}`)
        return { stop: false, nextNodeId: this.getNextNode(node.id) }
    }
  }

  /**
   * Message Node - Send a text message
   */
  private executeMessageNode(
    node: FlowNode,
    result: ExecutionResult
  ): { stop: boolean; nextNodeId: string | null } {
    const content = this.interpolateVariables(node.data.content as string || '')
    if (content) {
      result.responses.push(content)
    }
    return { stop: false, nextNodeId: this.getNextNode(node.id) }
  }

  /**
   * Question Node - Ask user and wait for response
   */
  private executeQuestionNode(
    node: FlowNode,
    result: ExecutionResult
  ): { stop: boolean; nextNodeId: string | null } {
    const question = this.interpolateVariables(node.data.question as string || '')
    const responseType = (node.data.responseType as string) || 'text'
    const options = (node.data.options as string[]) || []

    if (question) {
      if (responseType === 'buttons' && options.length > 0) {
        result.responses.push(`${question}\n\nOptions: ${options.join(', ')}`)
        result.newState.expectedOptions = options
      } else if (responseType === 'list' && options.length > 0) {
        result.responses.push(`${question}\n\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`)
        result.newState.expectedOptions = options
      } else {
        result.responses.push(question)
      }
    }

    result.newState.waitingForInput = true
    result.newState.inputType = responseType as 'text' | 'buttons' | 'list'
    result.newState.currentNodeId = node.id

    return { stop: true, nextNodeId: null }
  }

  /**
   * Condition Node - Branch based on variable value
   */
  private executeConditionNode(
    node: FlowNode,
    result: ExecutionResult
  ): { stop: boolean; nextNodeId: string | null } {
    const variable = node.data.variable as string
    const operator = (node.data.operator as string) || 'equals'
    const compareValue = node.data.value as string

    const actualValue = String(result.newState.variables[variable] || '')
    const conditionMet = this.evaluateCondition(actualValue, operator, compareValue)

    console.log(`[FlowExecutor] Condition: ${variable} ${operator} ${compareValue} = ${conditionMet}`)

    // Find edges from this node
    const edges = this.context.flowData.edges.filter((e) => e.source === node.id)

    // Look for true/false handles, or default to first edge
    let nextNodeId: string | null = null

    if (conditionMet) {
      const trueEdge = edges.find((e) => e.sourceHandle === 'true' || e.sourceHandle === 'yes')
      nextNodeId = trueEdge?.target || edges[0]?.target || null
    } else {
      const falseEdge = edges.find((e) => e.sourceHandle === 'false' || e.sourceHandle === 'no')
      nextNodeId = falseEdge?.target || edges[1]?.target || null
    }

    return { stop: false, nextNodeId }
  }

  /**
   * Action Node - Perform CRM actions
   */
  private async executeActionNode(
    node: FlowNode,
    result: ExecutionResult
  ): Promise<{ stop: boolean; nextNodeId: string | null }> {
    const actionType = node.data.actionType as string
    const { conversation } = this.context

    try {
      switch (actionType) {
        case 'tag':
          await prisma.contact.update({
            where: { id: conversation.contactId },
            data: {
              tags: {
                push: node.data.tagName as string,
              },
            },
          })
          console.log(`[FlowExecutor] Added tag: ${node.data.tagName}`)
          break

        case 'remove_tag':
          const contact = await prisma.contact.findUnique({
            where: { id: conversation.contactId },
            select: { tags: true },
          })
          if (contact) {
            await prisma.contact.update({
              where: { id: conversation.contactId },
              data: {
                tags: contact.tags.filter((t) => t !== node.data.tagName),
              },
            })
          }
          console.log(`[FlowExecutor] Removed tag: ${node.data.tagName}`)
          break

        case 'set_variable':
          result.newState.variables[node.data.variableName as string] = node.data.variableValue
          break

        case 'update_stage':
          await prisma.contact.update({
            where: { id: conversation.contactId },
            data: { stage: node.data.stage as 'NEW' | 'LEAD' | 'QUALIFIED' | 'CUSTOMER' | 'CHURNED' },
          })
          console.log(`[FlowExecutor] Updated stage to: ${node.data.stage}`)
          break

        case 'create_deal':
          const dealTitle = this.interpolateVariables((node.data.dealTitle as string) || 'New Deal')
          const pipelineId = node.data.pipelineId as string
          const stageId = node.data.stageId as string
          const rawValue = (node.data.dealValue as string) || '0'
          const dealValue = parseFloat(rawValue)

          if (pipelineId) {
            await prisma.deal.create({
              data: {
                title: dealTitle,
                value: isNaN(dealValue) ? 0 : dealValue,
                currency: (node.data.currency as string) || 'USD',
                pipelineId,
                stage: stageId || 'new',
                contactId: conversation.contactId,
                organizationId: this.context.chatbot.organizationId,
                createdBy: 'chatbot',
                probability: 50, // Default probability
              },
            })
            console.log(`[FlowExecutor] Created deal: ${dealTitle} in pipeline ${pipelineId}`)
          } else {
            console.warn('[FlowExecutor] Create Deal skipped: No pipeline ID')
          }
          break

        case 'assign_agent':
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { assignedTo: node.data.agentId as string },
          })
          break

        case 'webhook':
          // Call external webhook
          try {
            await fetch(node.data.webhookUrl as string, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId: conversation.id,
                contactId: conversation.contactId,
                variables: result.newState.variables,
              }),
            })
          } catch (webhookError) {
            console.error('[FlowExecutor] Webhook error:', webhookError)
          }
          break

        case 'handoff':
          // Disable AI and mark for human handoff
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { isAiEnabled: false },
          })
          if (node.data.handoffMessage) {
            result.responses.push(node.data.handoffMessage as string)
          }
          result.handoff = true
          return { stop: true, nextNodeId: null }
      }
    } catch (error) {
      console.error(`[FlowExecutor] Action error (${actionType}):`, error)
    }

    return { stop: false, nextNodeId: this.getNextNode(node.id) }
  }

  /**
   * Delay Node - Wait before continuing (for now, just continue)
   */
  private executeDelayNode(
    node: FlowNode,
    result: ExecutionResult
  ): { stop: boolean; nextNodeId: string | null } {
    // In a real implementation, this would schedule continuation
    // For now, we just continue immediately
    console.log(`[FlowExecutor] Delay: ${node.data.duration} ${node.data.unit}`)
    return { stop: false, nextNodeId: this.getNextNode(node.id) }
  }

  /**
   * AI Node - Generate AI response within flow
   */
  private async executeAINode(
    node: FlowNode,
    result: ExecutionResult
  ): Promise<{ stop: boolean; nextNodeId: string | null }> {
    const { chatbot, conversation, incomingMessage } = this.context
    const prompt = this.interpolateVariables(node.data.prompt as string || '')

    try {
      const aiManager = getAIManager()

      const messages: AIMessage[] = [
        {
          role: 'system',
          content: prompt || chatbot.systemPrompt || 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: incomingMessage.content || '',
        },
      ]

      const response = await aiManager.chat(messages, {
        provider: (node.data.provider as 'openai' | 'anthropic') || (chatbot.aiProvider as 'openai' | 'anthropic'),
        model: (node.data.model as string) || chatbot.aiModel,
        temperature: (node.data.temperature as number) || chatbot.temperature,
        maxTokens: (node.data.maxTokens as number) || chatbot.maxTokens,
      })

      if (response.content) {
        result.responses.push(response.content)

        // Store AI response in variable if specified
        if (node.data.saveToVariable) {
          result.newState.variables[node.data.saveToVariable as string] = response.content
        }
      }
    } catch (error) {
      console.error('[FlowExecutor] AI node error:', error)
      if (node.data.fallbackMessage) {
        result.responses.push(node.data.fallbackMessage as string)
      }
    }

    return { stop: false, nextNodeId: this.getNextNode(node.id) }
  }

  /**
   * Media Node - Send media message
   */
  private executeMediaNode(
    node: FlowNode,
    result: ExecutionResult
  ): { stop: boolean; nextNodeId: string | null } {
    const mediaType = (node.data.mediaType as string) || 'image'
    const mediaUrl = node.data.mediaUrl as string
    const caption = this.interpolateVariables(node.data.caption as string || '')

    if (mediaUrl) {
      result.mediaMessages.push({
        type: mediaType,
        url: mediaUrl,
        caption: caption || undefined,
      })
    }

    return { stop: false, nextNodeId: this.getNextNode(node.id) }
  }

  /**
   * Template Node - Send WhatsApp template
   */
  private executeTemplateNode(
    node: FlowNode,
    result: ExecutionResult
  ): { stop: boolean; nextNodeId: string | null } {
    const templateId = node.data.templateId as string
    const params = (node.data.params as Record<string, string>) || {}

    // Interpolate param values
    const interpolatedParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      interpolatedParams[key] = this.interpolateVariables(value)
    }

    if (templateId) {
      result.templateMessages.push({
        templateId,
        params: interpolatedParams,
      })
    }

    return { stop: false, nextNodeId: this.getNextNode(node.id) }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private getNode(nodeId: string): FlowNode | undefined {
    return this.context.flowData.nodes.find((n) => n.id === nodeId)
  }

  private getNextNode(currentNodeId: string): string | null {
    const edge = this.context.flowData.edges.find((e) => e.source === currentNodeId)
    return edge?.target || null
  }

  private interpolateVariables(text: string): string {
    if (!text) return ''

    const { contact } = this.context.conversation
    const variables = this.context.flowState.variables

    return text
      .replace(/\{\{name\}\}/gi, contact.name || 'there')
      .replace(/\{\{phone\}\}/gi, contact.phoneNumber || '')
      .replace(/\{\{email\}\}/gi, contact.email || '')
      .replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        return String(variables[varName] || `{{${varName}}}`)
      })
  }

  private evaluateCondition(
    actual: string,
    operator: string,
    expected: string
  ): boolean {
    const actualLower = actual.toLowerCase()
    const expectedLower = expected.toLowerCase()

    switch (operator) {
      case 'equals':
        return actualLower === expectedLower
      case 'not_equals':
        return actualLower !== expectedLower
      case 'contains':
        return actualLower.includes(expectedLower)
      case 'not_contains':
        return !actualLower.includes(expectedLower)
      case 'starts_with':
        return actualLower.startsWith(expectedLower)
      case 'ends_with':
        return actualLower.endsWith(expectedLower)
      case 'greater_than':
        return parseFloat(actual) > parseFloat(expected)
      case 'less_than':
        return parseFloat(actual) < parseFloat(expected)
      case 'is_empty':
        return actual.trim() === ''
      case 'is_not_empty':
        return actual.trim() !== ''
      default:
        return actualLower === expectedLower
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get or initialize flow state for a conversation
 */
export function getFlowState(conversation: Conversation): FlowState {
  const defaultState: FlowState = {
    currentNodeId: null,
    variables: {},
    waitingForInput: false,
    inputType: null,
    lastExecutedAt: new Date().toISOString(),
  }

  // Flow state is stored in conversation's aiSessionId as JSON
  // We'll use a new approach: store in a JSON field

  // For now, return default state - we'll enhance this
  return defaultState
}

/**
 * Save flow state to conversation
 */
export async function saveFlowState(
  conversationId: string,
  state: FlowState
): Promise<void> {
  // Store state as JSON in conversation metadata
  // Using tags field temporarily - ideally would have a dedicated field
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      // We'll store flow state in a custom way
      // For now, using updatedAt to trigger update
      updatedAt: new Date(),
    },
  })
}

/**
 * Create flow executor instance
 */
export function createFlowExecutor(context: FlowContext): FlowExecutor {
  return new FlowExecutor(context)
}
