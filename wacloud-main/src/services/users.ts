import prisma from '@/lib/db'
import type { UserRole } from '@prisma/client'

export async function createUser(data: {
  email: string
  name?: string
  avatarUrl?: string
  supabaseUserId: string
  organizationId: string
  role?: UserRole
}) {
  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
      supabaseUserId: data.supabaseUserId,
      organizationId: data.organizationId,
      role: data.role || 'MEMBER',
    },
  })
}

export async function getUserBySupabaseId(supabaseUserId: string) {
  return prisma.user.findUnique({
    where: { supabaseUserId },
    include: {
      organization: true,
    },
  })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      organization: true,
    },
  })
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      organization: true,
    },
  })
}

export async function updateUser(
  id: string,
  data: {
    name?: string
    avatarUrl?: string
    role?: UserRole
    isActive?: boolean
  }
) {
  return prisma.user.update({
    where: { id },
    data,
  })
}

export async function updateLastLogin(id: string) {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
    },
  })
}

export async function getOrganizationUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteUser(id: string) {
  return prisma.user.delete({
    where: { id },
  })
}
