import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { getMediaService } from '@/lib/services/media-service'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // image, video, document, etc.

    const mediaService = getMediaService()
    const result = await mediaService.listMedia(dbUser.organizationId, {
      page,
      limit,
      mimeTypePrefix: type ? `${type}/` : undefined,
    })

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(result.total / limit),
    })
  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
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
      select: { id: true, organizationId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const contentType = request.headers.get('content-type') || ''

    const mediaService = getMediaService()

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // Check file size (max 16MB)
      if (file.size > 16 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File size exceeds 16MB limit' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await mediaService.uploadFile(
        buffer,
        file.name,
        file.type,
        dbUser.organizationId,
        dbUser.id
      )

      return NextResponse.json({ data: result }, { status: 201 })
    } else {
      // Handle JSON body (base64 or URL upload)
      const body = await request.json()

      if (body.base64) {
        // Base64 upload
        const result = await mediaService.uploadFromBase64(
          body.base64,
          body.filename || 'file',
          body.mimeType || 'application/octet-stream',
          dbUser.organizationId,
          dbUser.id
        )

        return NextResponse.json({ data: result }, { status: 201 })
      } else if (body.url) {
        // URL upload
        const result = await mediaService.uploadFromUrl(
          body.url,
          dbUser.organizationId,
          dbUser.id
        )

        return NextResponse.json({ data: result }, { status: 201 })
      } else {
        return NextResponse.json(
          { error: 'No file, base64, or URL provided' },
          { status: 400 }
        )
      }
    }
  } catch (error) {
    console.error('Error uploading media:', error)
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    )
  }
}
