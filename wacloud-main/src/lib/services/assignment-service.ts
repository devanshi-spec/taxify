import { prisma } from '@/lib/db'

export type AssignmentStrategy = 'ROUND_ROBIN' | 'LEAST_BUSY' | 'SKILL_BASED'

interface AssignmentOptions {
  strategy: AssignmentStrategy
  organizationId: string
  requiredSkills?: string[]
  requiredLanguages?: string[]
  excludeAgentIds?: string[]
}

interface AvailableAgent {
  id: string
  userId: string
  status: string
  maxConcurrentChats: number
  currentLoad: number
  skills: string[]
  languages: string[]
}

export class AssignmentService {
  private static roundRobinIndex: Map<string, number> = new Map()

  /**
   * Get available agents for assignment
   */
  async getAvailableAgents(organizationId: string): Promise<AvailableAgent[]> {
    const agents = await prisma.agentStatus.findMany({
      where: {
        organizationId,
        status: 'ONLINE',
      },
    })

    // Filter agents who aren't at capacity
    return agents.filter((agent) => agent.currentLoad < agent.maxConcurrentChats)
  }

  /**
   * Auto-assign conversation to an agent based on strategy
   */
  async autoAssign(
    conversationId: string,
    options: AssignmentOptions
  ): Promise<string | null> {
    const availableAgents = await this.getAvailableAgents(options.organizationId)

    if (availableAgents.length === 0) {
      return null
    }

    // Filter by exclusions
    let candidates = availableAgents.filter(
      (agent) => !options.excludeAgentIds?.includes(agent.userId)
    )

    if (candidates.length === 0) {
      return null
    }

    // Apply skill/language filters for skill-based routing
    if (options.strategy === 'SKILL_BASED') {
      if (options.requiredSkills?.length) {
        candidates = candidates.filter((agent) =>
          options.requiredSkills!.every((skill) =>
            agent.skills.includes(skill.toLowerCase())
          )
        )
      }

      if (options.requiredLanguages?.length) {
        candidates = candidates.filter((agent) =>
          options.requiredLanguages!.some((lang) =>
            agent.languages.includes(lang.toLowerCase())
          )
        )
      }

      // Fall back to least busy if no skill match
      if (candidates.length === 0) {
        candidates = availableAgents.filter(
          (agent) => !options.excludeAgentIds?.includes(agent.userId)
        )
      }
    }

    if (candidates.length === 0) {
      return null
    }

    let selectedAgent: AvailableAgent

    switch (options.strategy) {
      case 'ROUND_ROBIN':
        selectedAgent = this.selectRoundRobin(candidates, options.organizationId)
        break
      case 'LEAST_BUSY':
        selectedAgent = this.selectLeastBusy(candidates)
        break
      case 'SKILL_BASED':
        // Already filtered by skills, now pick least busy among matches
        selectedAgent = this.selectLeastBusy(candidates)
        break
      default:
        selectedAgent = this.selectLeastBusy(candidates)
    }

    // Create assignment record
    await this.assignConversation(
      conversationId,
      selectedAgent.userId,
      options.organizationId,
      `AUTO_${options.strategy}` as 'AUTO_ROUND_ROBIN' | 'AUTO_LEAST_BUSY' | 'AUTO_SKILL_BASED'
    )

    return selectedAgent.userId
  }

  /**
   * Round robin selection
   */
  private selectRoundRobin(agents: AvailableAgent[], orgId: string): AvailableAgent {
    const currentIndex = AssignmentService.roundRobinIndex.get(orgId) || 0
    const nextIndex = (currentIndex + 1) % agents.length
    AssignmentService.roundRobinIndex.set(orgId, nextIndex)
    return agents[currentIndex]
  }

  /**
   * Least busy selection
   */
  private selectLeastBusy(agents: AvailableAgent[]): AvailableAgent {
    return agents.reduce((least, agent) => {
      const leastLoad = least.currentLoad / least.maxConcurrentChats
      const agentLoad = agent.currentLoad / agent.maxConcurrentChats
      return agentLoad < leastLoad ? agent : least
    })
  }

  /**
   * Manually assign conversation
   */
  async assignConversation(
    conversationId: string,
    assignedTo: string,
    organizationId: string,
    reason: 'MANUAL' | 'AUTO_ROUND_ROBIN' | 'AUTO_LEAST_BUSY' | 'AUTO_SKILL_BASED' | 'TRANSFER' = 'MANUAL',
    assignedBy?: string
  ): Promise<void> {
    // Close any existing assignments
    await prisma.conversationAssignment.updateMany({
      where: {
        conversationId,
        unassignedAt: null,
      },
      data: {
        unassignedAt: new Date(),
      },
    })

    // Create new assignment
    await prisma.conversationAssignment.create({
      data: {
        conversationId,
        assignedTo,
        assignedBy,
        reason,
      },
    })

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo },
    })

    // Update agent load
    await this.updateAgentLoad(assignedTo, organizationId, 1)
  }

  /**
   * Unassign conversation
   */
  async unassignConversation(
    conversationId: string,
    organizationId: string
  ): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { assignedTo: true },
    })

    if (conversation?.assignedTo) {
      // Close assignment record
      await prisma.conversationAssignment.updateMany({
        where: {
          conversationId,
          unassignedAt: null,
        },
        data: {
          unassignedAt: new Date(),
        },
      })

      // Clear assignment on conversation
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedTo: null },
      })

      // Update agent load
      await this.updateAgentLoad(conversation.assignedTo, organizationId, -1)
    }
  }

  /**
   * Transfer conversation to another agent
   */
  async transferConversation(
    conversationId: string,
    toAgentId: string,
    fromAgentId: string,
    organizationId: string
  ): Promise<void> {
    // Unassign from current agent
    await prisma.conversationAssignment.updateMany({
      where: {
        conversationId,
        unassignedAt: null,
      },
      data: {
        unassignedAt: new Date(),
      },
    })

    // Update loads
    await this.updateAgentLoad(fromAgentId, organizationId, -1)

    // Assign to new agent
    await this.assignConversation(
      conversationId,
      toAgentId,
      organizationId,
      'TRANSFER',
      fromAgentId
    )
  }

  /**
   * Update agent load count
   */
  private async updateAgentLoad(
    userId: string,
    organizationId: string,
    delta: number
  ): Promise<void> {
    await prisma.agentStatus.upsert({
      where: { userId },
      update: {
        currentLoad: { increment: delta },
      },
      create: {
        userId,
        organizationId,
        currentLoad: Math.max(0, delta),
      },
    })
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    userId: string,
    organizationId: string,
    status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE'
  ): Promise<void> {
    await prisma.agentStatus.upsert({
      where: { userId },
      update: {
        status,
        lastActiveAt: new Date(),
      },
      create: {
        userId,
        organizationId,
        status,
      },
    })
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(userId: string, organizationId: string) {
    const assignments = await prisma.conversationAssignment.findMany({
      where: {
        assignedTo: userId,
        assignedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    })

    const completed = assignments.filter((a) => a.unassignedAt !== null)
    const avgFirstResponse =
      completed.filter((a) => a.firstResponseTime).reduce(
        (sum, a) => sum + (a.firstResponseTime || 0),
        0
      ) / (completed.filter((a) => a.firstResponseTime).length || 1)
    const avgResolution =
      completed.filter((a) => a.resolutionTime).reduce(
        (sum, a) => sum + (a.resolutionTime || 0),
        0
      ) / (completed.filter((a) => a.resolutionTime).length || 1)

    return {
      totalAssignments: assignments.length,
      completedAssignments: completed.length,
      avgFirstResponseTime: Math.round(avgFirstResponse / 1000), // Convert to seconds
      avgResolutionTime: Math.round(avgResolution / 60000), // Convert to minutes
    }
  }
}

// Singleton instance
let assignmentService: AssignmentService | null = null

export function getAssignmentService(): AssignmentService {
  if (!assignmentService) {
    assignmentService = new AssignmentService()
  }
  return assignmentService
}
