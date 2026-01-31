import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getContactImportService } from '@/lib/services/import-service'

// POST - Upload and start import process
export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const channelId = formData.get('channelId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    // Verify channel belongs to organization
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId: dbUser.organizationId,
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Read file content
    const fileContent = await file.text()
    const importService = getContactImportService()

    // Parse CSV to get headers and preview
    const parseResult = importService.parseCSV(fileContent)
    const autoMapping = importService.autoDetectMapping(parseResult.headers)

    // Create import record
    const contactImport = await prisma.contactImport.create({
      data: {
        fileName: file.name,
        originalName: file.name,
        status: 'MAPPING',
        totalRows: parseResult.totalRows,
        fieldMapping: autoMapping,
        channelId,
        organizationId: dbUser.organizationId,
        createdBy: dbUser.id,
      },
    })

    // Store file content temporarily (in production, use blob storage)
    // For now, we'll store in the database as JSON
    await prisma.contactImport.update({
      where: { id: contactImport.id },
      data: {
        errors: JSON.stringify({ _fileContent: fileContent }),
      },
    })

    return NextResponse.json({
      success: true,
      import: {
        id: contactImport.id,
        fileName: contactImport.fileName,
        status: contactImport.status,
        totalRows: contactImport.totalRows,
      },
      preview: {
        headers: parseResult.headers,
        rows: parseResult.rows.slice(0, 5), // Preview first 5 rows
        totalRows: parseResult.totalRows,
      },
      mapping: autoMapping,
    })
  } catch (error) {
    console.error('Error uploading import file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    )
  }
}

// GET - List imports
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
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: Record<string, unknown> = {
      organizationId: dbUser.organizationId,
    }

    if (channelId) {
      where.channelId = channelId
    }

    if (status) {
      where.status = status
    }

    const [imports, total] = await Promise.all([
      prisma.contactImport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactImport.count({ where }),
    ])

    // Get channels for the imports
    const channelIds = [...new Set(imports.map((imp) => imp.channelId))]
    const channels = await prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, name: true },
    })
    const channelMap = new Map(channels.map((c) => [c.id, c]))

    // Clean up internal data from response
    const cleanedImports = imports.map((imp) => ({
      ...imp,
      channel: channelMap.get(imp.channelId) || null,
      errors: imp.errors && typeof imp.errors === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(imp.errors)
              // Remove internal file content
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { _fileContent, ...errors } = parsed
              return Object.keys(errors).length > 0 ? errors : null
            } catch {
              return imp.errors
            }
          })()
        : imp.errors,
    }))

    return NextResponse.json({
      data: cleanedImports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching imports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch imports' },
      { status: 500 }
    )
  }
}
