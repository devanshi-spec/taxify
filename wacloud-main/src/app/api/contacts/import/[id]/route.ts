import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getContactImportService, FieldMapping } from '@/lib/services/import-service'

// GET - Get import status and details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const contactImport = await prisma.contactImport.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    // Get channel separately since there's no relation
    const channel = contactImport ? await prisma.channel.findUnique({
      where: { id: contactImport.channelId },
      select: { id: true, name: true },
    }) : null

    if (!contactImport) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // Parse errors if present
    let errors = null
    let preview = null

    if (contactImport.errors && typeof contactImport.errors === 'string') {
      try {
        const parsed = JSON.parse(contactImport.errors)
        const { _fileContent, ...restErrors } = parsed

        // If in mapping status, provide preview
        if (contactImport.status === 'MAPPING' && _fileContent) {
          const importService = getContactImportService()
          const parseResult = importService.parseCSV(_fileContent)
          preview = {
            headers: parseResult.headers,
            rows: parseResult.rows.slice(0, 5),
            totalRows: parseResult.totalRows,
          }
        }

        if (Object.keys(restErrors).length > 0) {
          errors = restErrors
        }
      } catch {
        errors = contactImport.errors
      }
    }

    return NextResponse.json({
      import: {
        id: contactImport.id,
        fileName: contactImport.fileName,
        status: contactImport.status,
        totalRows: contactImport.totalRows,
        processedRows: contactImport.processedRows,
        successCount: contactImport.successCount,
        errorCount: contactImport.errorCount,
        fieldMapping: contactImport.fieldMapping,
        channel,
        startedAt: contactImport.startedAt,
        completedAt: contactImport.completedAt,
        createdAt: contactImport.createdAt,
      },
      errors,
      preview,
    })
  } catch (error) {
    console.error('Error fetching import:', error)
    return NextResponse.json(
      { error: 'Failed to fetch import' },
      { status: 500 }
    )
  }
}

// PUT - Update mapping and start processing
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const { mapping } = body as { mapping: FieldMapping }

    if (!mapping) {
      return NextResponse.json({ error: 'Mapping is required' }, { status: 400 })
    }

    const contactImport = await prisma.contactImport.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!contactImport) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    if (contactImport.status !== 'MAPPING') {
      return NextResponse.json(
        { error: 'Import cannot be updated in current status' },
        { status: 400 }
      )
    }

    // Validate mapping
    const importService = getContactImportService()
    const validation = importService.validateMapping(mapping)

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid mapping', details: validation.errors },
        { status: 400 }
      )
    }

    // Update mapping
    await prisma.contactImport.update({
      where: { id },
      data: { fieldMapping: mapping },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating import mapping:', error)
    return NextResponse.json(
      { error: 'Failed to update mapping' },
      { status: 500 }
    )
  }
}

// POST - Execute the import
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const contactImport = await prisma.contactImport.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!contactImport) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    if (contactImport.status !== 'MAPPING') {
      return NextResponse.json(
        { error: 'Import is not ready to process' },
        { status: 400 }
      )
    }

    // Get file content from stored data
    let fileContent = ''
    if (contactImport.errors && typeof contactImport.errors === 'string') {
      try {
        const parsed = JSON.parse(contactImport.errors)
        fileContent = parsed._fileContent || ''
      } catch {
        return NextResponse.json(
          { error: 'Import data corrupted' },
          { status: 500 }
        )
      }
    }

    if (!fileContent) {
      return NextResponse.json(
        { error: 'Import file not found' },
        { status: 500 }
      )
    }

    // Update status to processing
    await prisma.contactImport.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        errors: Prisma.DbNull, // Clear temporary storage
      },
    })

    // Process import
    const importService = getContactImportService()
    const parseResult = importService.parseCSV(fileContent)
    const mapping = contactImport.fieldMapping as FieldMapping

    const result = await importService.processImport(
      id,
      parseResult.rows,
      mapping,
      contactImport.channelId,
      dbUser.organizationId
    )

    return NextResponse.json({
      success: result.success,
      result: {
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors.slice(0, 20), // Return first 20 errors
      },
    })
  } catch (error) {
    console.error('Error executing import:', error)

    // Update status to failed
    const { id } = await params
    await prisma.contactImport.update({
      where: { id },
      data: { status: 'FAILED' },
    }).catch(() => {})

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel/delete import
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const contactImport = await prisma.contactImport.findFirst({
      where: {
        id,
        organizationId: dbUser.organizationId,
      },
    })

    if (!contactImport) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    if (contactImport.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Cannot delete import while processing' },
        { status: 400 }
      )
    }

    await prisma.contactImport.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting import:', error)
    return NextResponse.json(
      { error: 'Failed to delete import' },
      { status: 500 }
    )
  }
}
