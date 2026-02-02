import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const storageBucket = process.env.STORAGE_BUCKET || 'whatsapp-crm-media'

// Create admin client for storage operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export interface UploadResult {
  id: string
  url: string
  thumbnailUrl?: string
  filename: string
  originalName: string
  mimeType: string
  size: number
}

export class MediaService {
  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: Buffer | Blob,
    filename: string,
    mimeType: string,
    organizationId: string,
    uploadedBy: string
  ): Promise<UploadResult> {
    try {
      // Generate unique filename
      const ext = filename.split('.').pop() || ''
      const uniqueFilename = `${uuidv4()}.${ext}`
      const storagePath = `${organizationId}/${uniqueFilename}`

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from(storageBucket)
        .upload(storagePath, file, {
          contentType: mimeType,
          upsert: false,
        })

      if (error) {
        console.error('[Media] Upload error:', error)
        throw new Error(`Failed to upload file: ${error.message}`)
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(storageBucket)
        .getPublicUrl(storagePath)

      const publicUrl = urlData.publicUrl

      // Get file size
      const size = Buffer.isBuffer(file) ? file.length : (file as Blob).size

      // Generate thumbnail for images
      let thumbnailUrl: string | undefined
      if (mimeType.startsWith('image/')) {
        thumbnailUrl = await this.generateThumbnailUrl(storagePath)
      }

      // Save to database
      const media = await prisma.media.create({
        data: {
          filename: uniqueFilename,
          originalName: filename,
          mimeType,
          size,
          url: publicUrl,
          thumbnailUrl,
          storageProvider: 'supabase',
          storagePath,
          organizationId,
          uploadedBy,
        },
      })

      return {
        id: media.id,
        url: publicUrl,
        thumbnailUrl,
        filename: uniqueFilename,
        originalName: filename,
        mimeType,
        size,
      }
    } catch (error) {
      console.error('[Media] Upload failed:', error)
      throw error
    }
  }

  /**
   * Upload from base64 string
   */
  async uploadFromBase64(
    base64Data: string,
    filename: string,
    mimeType: string,
    organizationId: string,
    uploadedBy: string
  ): Promise<UploadResult> {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Content, 'base64')

    return this.uploadFile(buffer, filename, mimeType, organizationId, uploadedBy)
  }

  /**
   * Upload from URL
   */
  async uploadFromUrl(
    url: string,
    organizationId: string,
    uploadedBy: string
  ): Promise<UploadResult> {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const buffer = Buffer.from(await response.arrayBuffer())

      // Extract filename from URL
      const urlPath = new URL(url).pathname
      const filename = urlPath.split('/').pop() || 'file'

      return this.uploadFile(buffer, filename, contentType, organizationId, uploadedBy)
    } catch (error) {
      console.error('[Media] URL upload failed:', error)
      throw error
    }
  }

  /**
   * Generate thumbnail URL for images
   */
  private async generateThumbnailUrl(storagePath: string): Promise<string | undefined> {
    try {
      // Supabase supports image transformations
      const { data } = supabaseAdmin.storage
        .from(storageBucket)
        .getPublicUrl(storagePath, {
          transform: {
            width: 200,
            height: 200,
            resize: 'contain',
          },
        })

      return data.publicUrl
    } catch (error) {
      console.error('[Media] Thumbnail generation failed:', error)
      return undefined
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(mediaId: string): Promise<void> {
    try {
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
      })

      if (!media) {
        throw new Error('Media not found')
      }

      // Delete from storage
      const { error } = await supabaseAdmin.storage
        .from(storageBucket)
        .remove([media.storagePath])

      if (error) {
        console.error('[Media] Delete error:', error)
      }

      // Delete from database
      await prisma.media.delete({
        where: { id: mediaId },
      })
    } catch (error) {
      console.error('[Media] Delete failed:', error)
      throw error
    }
  }

  /**
   * Get media by ID
   */
  async getMedia(mediaId: string): Promise<{
    id: string
    url: string
    thumbnailUrl: string | null
    filename: string
    originalName: string
    mimeType: string
    size: number
  } | null> {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })

    if (!media) {
      return null
    }

    return {
      id: media.id,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
    }
  }

  /**
   * List media for organization
   */
  async listMedia(
    organizationId: string,
    options?: {
      page?: number
      limit?: number
      mimeTypePrefix?: string
    }
  ): Promise<{
    data: Array<{
      id: string
      url: string
      thumbnailUrl: string | null
      filename: string
      originalName: string
      mimeType: string
      size: number
      createdAt: Date
    }>
    total: number
  }> {
    const page = options?.page || 1
    const limit = options?.limit || 20

    const where: Record<string, unknown> = { organizationId }

    if (options?.mimeTypePrefix) {
      where.mimeType = { startsWith: options.mimeTypePrefix }
    }

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.media.count({ where }),
    ])

    return {
      data: media.map(m => ({
        id: m.id,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        filename: m.filename,
        originalName: m.originalName,
        mimeType: m.mimeType,
        size: m.size,
        createdAt: m.createdAt,
      })),
      total,
    }
  }

  /**
   * Increment usage count for a media item
   */
  async incrementUsage(mediaId: string): Promise<void> {
    await prisma.media.update({
      where: { id: mediaId },
      data: { usageCount: { increment: 1 } },
    })
  }
}

// Singleton instance
let mediaService: MediaService | null = null

export function getMediaService(): MediaService {
  if (!mediaService) {
    mediaService = new MediaService()
  }
  return mediaService
}
