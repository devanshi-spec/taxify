import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { EvolutionApiClient } from '@/lib/evolution-api/client'

const createChannelSchema = z.object({
  instagramId: z.string().optional(),
  platform: z.enum(['WHATSAPP', 'INSTAGRAM']).optional().default('WHATSAPP'),
  name: z.string().min(1),
  phoneNumber: z.string().optional(),
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
  connectionType: z.enum(['CLOUD_API', 'EVOLUTION_API']),
  evolutionInstance: z.string().optional(),
  evolutionApiKey: z.string().optional(),
  instanceName: z.string().optional(),
  accessToken: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  businessProfile: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, organizationId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const connectionType = searchParams.get('connectionType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Prisma.ChannelWhereInput = {
      organizationId: dbUser.organizationId,
    }

    if (status) where.status = status as Prisma.EnumChannelStatusFilter['equals']
    if (connectionType) where.connectionType = connectionType as Prisma.EnumConnectionTypeFilter['equals']

    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        include: {
          _count: {
            select: { contacts: true, conversations: true, campaigns: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.channel.count({ where }),
    ])

    return NextResponse.json({
      data: channels,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, organizationId: true, organization: { select: { maxChannels: true, slug: true } } },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check channel limit
    const currentChannelCount = await prisma.channel.count({
      where: { organizationId: dbUser.organizationId },
    })

    if (currentChannelCount >= dbUser.organization.maxChannels) {
      return NextResponse.json(
        { error: 'Channel limit reached. Please upgrade your plan.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createChannelSchema.parse(body)

    // Check for duplicate phone number in organization (only if phone number is provided)
    if (validatedData.phoneNumber) {
      const existingChannel = await prisma.channel.findFirst({
        where: {
          phoneNumber: validatedData.phoneNumber,
          organizationId: dbUser.organizationId,
        },
      })

      if (existingChannel) {
        return NextResponse.json(
          { error: 'A channel with this phone number already exists' },
          { status: 409 }
        )
      }
    }

    // Check for duplicate Instagram ID
    if (validatedData.platform === 'INSTAGRAM' && validatedData.instagramId) {
      const existingChannel = await prisma.channel.findFirst({
        where: {
          instagramId: validatedData.instagramId,
          organizationId: dbUser.organizationId,
        },
      })

      if (existingChannel) {
        return NextResponse.json(
          { error: 'A channel with this Instagram ID already exists' },
          { status: 409 }
        )
      }
    }

    // Store settings
    const settings: Record<string, unknown> = validatedData.settings || {}
    // Note: We also store accessToken in the column for easier access, but keep in settings for backward compat if needed
    if (validatedData.accessToken) {
      settings.accessToken = validatedData.accessToken
    }

    let evolutionInstance = validatedData.evolutionInstance || validatedData.instanceName
    let evolutionApiKey = validatedData.evolutionApiKey
    let qrCode: string | null = null

    // If Evolution API, create instance
    if (validatedData.connectionType === 'EVOLUTION_API') {
      const evolutionApiUrl = process.env.EVOLUTION_API_URL
      const evolutionGlobalKey = process.env.EVOLUTION_API_KEY

      if (evolutionApiUrl && evolutionGlobalKey) {
        const evolutionClient = new EvolutionApiClient({
          baseUrl: evolutionApiUrl,
          apiKey: evolutionGlobalKey,
        })

        // Generate instance name if not provided
        if (!evolutionInstance) {
          evolutionInstance = `${dbUser.organization.slug}-${Date.now()}`
        }

        try {
          // Create the instance in Evolution API
          const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const webhookUrl = `${webhookBaseUrl}/api/webhooks/evolution`

          const instanceResult = await evolutionClient.createInstance(evolutionInstance, {
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            webhook: {
              url: webhookUrl,
              webhookByEvents: true,
              webhookBase64: true,
              events: [
                'messages.upsert',
                'messages.update',
                'send.message',
                'connection.update',
                'qrcode.updated',
                'presence.update',
              ],
            },
          })

          // Store the instance token/key
          evolutionApiKey = instanceResult.hash || evolutionGlobalKey

          // Get QR code if available
          if (instanceResult.qrcode?.base64) {
            qrCode = instanceResult.qrcode.base64
            settings.qrCode = qrCode
            settings.qrCodeUpdatedAt = new Date().toISOString()
          }

          console.log(`[Channels] Created Evolution instance: ${evolutionInstance}`)
        } catch (evolutionError) {
          console.error('[Channels] Error creating Evolution instance:', evolutionError)
          return NextResponse.json(
            { error: 'Failed to create WhatsApp instance. Please check Evolution API configuration.' },
            { status: 500 }
          )
        }
      } else {
        console.warn('[Channels] Evolution API not configured, creating channel without instance')
      }
    }

    const channel = await prisma.channel.create({
      data: {
        name: validatedData.name,
        phoneNumber: validatedData.phoneNumber,
        phoneNumberId: validatedData.phoneNumberId,
        wabaId: validatedData.wabaId,
        instagramId: validatedData.instagramId,
        accessToken: validatedData.accessToken,
        platform: validatedData.platform,
        connectionType: validatedData.connectionType,
        evolutionInstance,
        evolutionApiKey,
        webhookUrl: validatedData.webhookUrl,
        webhookSecret: validatedData.webhookSecret,
        businessProfile: validatedData.businessProfile as Prisma.InputJsonValue | undefined,
        settings: Object.keys(settings).length > 0 ? settings as Prisma.InputJsonValue : undefined,
        organizationId: dbUser.organizationId,
        status: validatedData.status || 'PENDING',
      },
    })

    // Return channel with QR code if available
    const responseData: Record<string, unknown> = { ...channel }
    if (qrCode) {
      responseData.qrCode = qrCode
    }

    return NextResponse.json({ data: responseData }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating channel:', error)
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    )
  }
}
