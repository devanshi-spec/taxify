import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { EvolutionApiClient } from '@/lib/evolution-api/client'
import type { Prisma } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const channel = await prisma.channel.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    if (channel.connectionType !== 'EVOLUTION_API') {
      return NextResponse.json(
        { error: 'QR code is only available for Evolution API connections' },
        { status: 400 }
      )
    }

    if (!channel.evolutionInstance) {
      return NextResponse.json(
        { error: 'Evolution instance not configured' },
        { status: 400 }
      )
    }

    // Check if we have a cached QR code
    const settings = channel.settings as { qrCode?: string; qrCodeUpdatedAt?: string } | null
    if (settings?.qrCode && settings?.qrCodeUpdatedAt) {
      const qrCodeAge = Date.now() - new Date(settings.qrCodeUpdatedAt).getTime()
      // QR codes are valid for about 30 seconds, but we'll cache for 20
      if (qrCodeAge < 20000) {
        return NextResponse.json({
          data: {
            qrCode: settings.qrCode,
            updatedAt: settings.qrCodeUpdatedAt,
            cached: true,
          },
        })
      }
    }

    // Fetch fresh QR code from Evolution API
    const evolutionApiUrl = process.env.EVOLUTION_API_URL
    const evolutionApiKey = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY

    if (!evolutionApiUrl || !evolutionApiKey) {
      return NextResponse.json(
        { error: 'Evolution API not configured' },
        { status: 500 }
      )
    }

    const evolutionClient = new EvolutionApiClient({
      baseUrl: evolutionApiUrl,
      apiKey: evolutionApiKey,
    })

    try {
      const qrCodeResult = await evolutionClient.connectInstance(channel.evolutionInstance)

      if (qrCodeResult.base64 || qrCodeResult.code) {
        // Cache the QR code
        const newSettings: Record<string, unknown> = {
          ...(channel.settings as Record<string, unknown> || {}),
          qrCode: qrCodeResult.base64 || null,
          qrCodeText: qrCodeResult.code || null,
          pairingCode: qrCodeResult.pairingCode || null,
          qrCodeUpdatedAt: new Date().toISOString(),
        }

        await prisma.channel.update({
          where: { id },
          data: {
            settings: newSettings as Prisma.InputJsonValue,
          },
        })

        return NextResponse.json({
          data: {
            qrCode: qrCodeResult.base64,
            qrCodeText: qrCodeResult.code,
            pairingCode: qrCodeResult.pairingCode,
            updatedAt: new Date().toISOString(),
            cached: false,
          },
        })
      }

      return NextResponse.json({
        data: {
          qrCode: null,
          message: 'Instance may already be connected or QR code not available',
        },
      })
    } catch (evolutionError) {
      console.error('[QRCode] Error fetching QR code:', evolutionError)

      // Try to get connection state
      try {
        const state = await evolutionClient.getConnectionState(channel.evolutionInstance)
        if (state.state === 'open') {
          return NextResponse.json({
            data: {
              connected: true,
              message: 'Instance is already connected',
            },
          })
        }
      } catch {
        // Ignore state check error
      }

      return NextResponse.json(
        { error: 'Failed to get QR code from Evolution API' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error fetching QR code:', error)
    return NextResponse.json(
      { error: 'Failed to fetch QR code' },
      { status: 500 }
    )
  }
}

// POST to reconnect/refresh instance
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const channel = await prisma.channel.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    if (channel.connectionType !== 'EVOLUTION_API' || !channel.evolutionInstance) {
      return NextResponse.json(
        { error: 'Invalid channel configuration' },
        { status: 400 }
      )
    }

    const evolutionApiUrl = process.env.EVOLUTION_API_URL
    const evolutionApiKey = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY

    if (!evolutionApiUrl || !evolutionApiKey) {
      return NextResponse.json(
        { error: 'Evolution API not configured' },
        { status: 500 }
      )
    }

    const evolutionClient = new EvolutionApiClient({
      baseUrl: evolutionApiUrl,
      apiKey: evolutionApiKey,
    })

    try {
      // Restart the instance to get a fresh connection
      await evolutionClient.restartInstance(channel.evolutionInstance)

      // Wait a bit for restart
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Get fresh QR code
      const qrCodeResult = await evolutionClient.connectInstance(channel.evolutionInstance)

      // Update channel status and cache QR code
      const newSettings: Record<string, unknown> = {
        ...(channel.settings as Record<string, unknown> || {}),
        qrCode: qrCodeResult.base64 || null,
        qrCodeText: qrCodeResult.code || null,
        pairingCode: qrCodeResult.pairingCode || null,
        qrCodeUpdatedAt: new Date().toISOString(),
      }

      await prisma.channel.update({
        where: { id },
        data: {
          status: 'PENDING',
          settings: newSettings as Prisma.InputJsonValue,
        },
      })

      return NextResponse.json({
        data: {
          qrCode: qrCodeResult.base64,
          qrCodeText: qrCodeResult.code,
          pairingCode: qrCodeResult.pairingCode,
          updatedAt: new Date().toISOString(),
          message: 'Instance restarted successfully',
        },
      })
    } catch (evolutionError) {
      console.error('[QRCode] Error restarting instance:', evolutionError)
      return NextResponse.json(
        { error: 'Failed to restart instance' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error reconnecting channel:', error)
    return NextResponse.json(
      { error: 'Failed to reconnect channel' },
      { status: 500 }
    )
  }
}
