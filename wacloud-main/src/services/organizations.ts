import prisma from '@/lib/db'
import type { Plan } from '@prisma/client'

export async function createOrganization(data: {
  name: string
  slug: string
  plan?: Plan
}) {
  return prisma.organization.create({
    data: {
      name: data.name,
      slug: data.slug,
      plan: data.plan || 'FREE',
    },
  })
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      users: true,
      channels: true,
    },
  })
}

export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    include: {
      users: true,
      channels: true,
    },
  })
}

export async function updateOrganization(
  id: string,
  data: {
    name?: string
    plan?: Plan
    billingEmail?: string
  }
) {
  return prisma.organization.update({
    where: { id },
    data,
  })
}

export async function getOrganizationStats(organizationId: string) {
  const [contacts, conversations, channels, users] = await Promise.all([
    prisma.contact.count({ where: { organizationId } }),
    prisma.conversation.count({ where: { organizationId } }),
    prisma.channel.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId } }),
  ])

  return { contacts, conversations, channels, users }
}
