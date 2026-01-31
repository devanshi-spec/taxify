import prisma from '@/lib/db'
import type { ContactStage, Prisma } from '@prisma/client'

export interface CreateContactInput {
  phoneNumber: string
  name?: string
  email?: string
  channelId: string
  organizationId: string
  tags?: string[]
  customFields?: Record<string, unknown>
  notes?: string
  stage?: ContactStage
}

export interface UpdateContactInput {
  name?: string
  email?: string
  avatarUrl?: string
  tags?: string[]
  customFields?: Record<string, unknown>
  notes?: string
  segment?: string
  leadScore?: number
  stage?: ContactStage
  isOptedIn?: boolean
  assignedTo?: string | null
}

export interface ContactFilters {
  organizationId: string
  channelId?: string
  search?: string
  stage?: ContactStage
  tags?: string[]
  assignedTo?: string
  isOptedIn?: boolean
}

export async function createContact(data: CreateContactInput) {
  return prisma.contact.create({
    data: {
      phoneNumber: data.phoneNumber,
      name: data.name,
      email: data.email,
      channelId: data.channelId,
      organizationId: data.organizationId,
      tags: data.tags || [],
      customFields: data.customFields as Prisma.InputJsonValue | undefined,
      notes: data.notes,
      stage: data.stage || 'NEW',
    },
    include: {
      channel: true,
    },
  })
}

export async function getContactById(id: string) {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      channel: true,
      conversations: {
        take: 1,
        orderBy: { lastMessageAt: 'desc' },
      },
    },
  })
}

export async function getContactByPhone(phoneNumber: string, channelId: string) {
  return prisma.contact.findUnique({
    where: {
      phoneNumber_channelId: {
        phoneNumber,
        channelId,
      },
    },
    include: {
      channel: true,
    },
  })
}

export async function getContacts(
  filters: ContactFilters,
  options: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
) {
  const { page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options

  const where: Prisma.ContactWhereInput = {
    organizationId: filters.organizationId,
  }

  if (filters.channelId) {
    where.channelId = filters.channelId
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phoneNumber: { contains: filters.search } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (filters.stage) {
    where.stage = filters.stage
  }

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags }
  }

  if (filters.assignedTo) {
    where.assignedTo = filters.assignedTo
  }

  if (filters.isOptedIn !== undefined) {
    where.isOptedIn = filters.isOptedIn
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        channel: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
  ])

  return {
    contacts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function updateContact(id: string, data: UpdateContactInput) {
  return prisma.contact.update({
    where: { id },
    data: {
      ...data,
      customFields: data.customFields as Prisma.InputJsonValue | undefined,
    },
    include: {
      channel: true,
    },
  })
}

export async function updateContactTags(id: string, tags: string[]) {
  return prisma.contact.update({
    where: { id },
    data: { tags },
  })
}

export async function addTagToContact(id: string, tag: string) {
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) throw new Error('Contact not found')

  const newTags = [...new Set([...contact.tags, tag])]
  return prisma.contact.update({
    where: { id },
    data: { tags: newTags },
  })
}

export async function removeTagFromContact(id: string, tag: string) {
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) throw new Error('Contact not found')

  const newTags = contact.tags.filter((t) => t !== tag)
  return prisma.contact.update({
    where: { id },
    data: { tags: newTags },
  })
}

export async function deleteContact(id: string) {
  return prisma.contact.delete({
    where: { id },
  })
}

export async function bulkDeleteContacts(ids: string[]) {
  return prisma.contact.deleteMany({
    where: { id: { in: ids } },
  })
}

export async function bulkUpdateContactsStage(ids: string[], stage: ContactStage) {
  return prisma.contact.updateMany({
    where: { id: { in: ids } },
    data: { stage },
  })
}

export async function bulkAddTagToContacts(ids: string[], tag: string) {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids } },
    select: { id: true, tags: true },
  })

  const updates = contacts.map((contact) =>
    prisma.contact.update({
      where: { id: contact.id },
      data: { tags: [...new Set([...contact.tags, tag])] },
    })
  )

  return Promise.all(updates)
}

export async function getContactStats(organizationId: string) {
  const [total, byStage, optedIn, optedOut] = await Promise.all([
    prisma.contact.count({ where: { organizationId } }),
    prisma.contact.groupBy({
      by: ['stage'],
      where: { organizationId },
      _count: true,
    }),
    prisma.contact.count({ where: { organizationId, isOptedIn: true } }),
    prisma.contact.count({ where: { organizationId, isOptedIn: false } }),
  ])

  return {
    total,
    byStage: byStage.reduce(
      (acc, item) => ({ ...acc, [item.stage]: item._count }),
      {} as Record<ContactStage, number>
    ),
    optedIn,
    optedOut,
  }
}

export async function importContacts(
  contacts: CreateContactInput[],
  options: { skipDuplicates?: boolean } = {}
) {
  const results = {
    created: 0,
    skipped: 0,
    errors: [] as { phoneNumber: string; error: string }[],
  }

  for (const contact of contacts) {
    try {
      const existing = await getContactByPhone(contact.phoneNumber, contact.channelId)
      if (existing) {
        if (options.skipDuplicates) {
          results.skipped++
          continue
        }
        results.errors.push({
          phoneNumber: contact.phoneNumber,
          error: 'Contact already exists',
        })
        continue
      }

      await createContact(contact)
      results.created++
    } catch (error) {
      results.errors.push({
        phoneNumber: contact.phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}
