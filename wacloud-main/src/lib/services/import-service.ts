import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { parse } from 'csv-parse/sync'

export interface CSVParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}

export interface FieldMapping {
  [csvColumn: string]: string | null // Maps to Contact field name or null to skip
}

export interface ImportResult {
  success: boolean
  importId: string
  totalRows: number
  successCount: number
  errorCount: number
  errors: ImportError[]
}

export interface ImportError {
  row: number
  field: string
  value: string
  error: string
}

// Contact fields that can be imported
export const IMPORTABLE_FIELDS = [
  { value: 'phoneNumber', label: 'Phone Number', required: true },
  { value: 'name', label: 'Name', required: false },
  { value: 'email', label: 'Email', required: false },
  { value: 'segment', label: 'Segment', required: false },
  { value: 'tags', label: 'Tags (comma-separated)', required: false },
  { value: 'notes', label: 'Notes', required: false },
  { value: 'stage', label: 'Stage (NEW/LEAD/QUALIFIED/CUSTOMER/CHURNED)', required: false },
] as const

export class ContactImportService {
  /**
   * Parse CSV content and return headers and sample rows
   */
  parseCSV(fileContent: string): CSVParseResult {
    try {
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, string>[]

      if (records.length === 0) {
        throw new Error('CSV file is empty')
      }

      const headers = Object.keys(records[0])

      return {
        headers,
        rows: records,
        totalRows: records.length,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse CSV: ${error.message}`)
      }
      throw new Error('Failed to parse CSV file')
    }
  }

  /**
   * Auto-detect field mappings based on header names
   */
  autoDetectMapping(headers: string[]): FieldMapping {
    const mapping: FieldMapping = {}

    const phonePatterns = ['phone', 'mobile', 'cell', 'telephone', 'whatsapp', 'number']
    const namePatterns = ['name', 'full_name', 'fullname', 'contact_name']
    const emailPatterns = ['email', 'e-mail', 'mail']
    const segmentPatterns = ['segment', 'group', 'category']
    const tagPatterns = ['tags', 'tag', 'labels', 'label']
    const notePatterns = ['notes', 'note', 'description', 'comment']
    const stagePatterns = ['stage', 'status', 'lead_status']

    for (const header of headers) {
      const headerLower = header.toLowerCase().replace(/[^a-z]/g, '')

      if (phonePatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'phoneNumber'
      } else if (namePatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'name'
      } else if (emailPatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'email'
      } else if (segmentPatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'segment'
      } else if (tagPatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'tags'
      } else if (notePatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'notes'
      } else if (stagePatterns.some((p) => headerLower.includes(p))) {
        mapping[header] = 'stage'
      } else {
        mapping[header] = null // Skip by default
      }
    }

    return mapping
  }

  /**
   * Validate field mapping
   */
  validateMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const mappedFields = Object.values(mapping).filter((v) => v !== null)

    // Check required field
    if (!mappedFields.includes('phoneNumber')) {
      errors.push('Phone Number is required and must be mapped to a column')
    }

    // Check for duplicates
    const duplicates = mappedFields.filter(
      (item, index) => item !== null && mappedFields.indexOf(item) !== index
    )
    if (duplicates.length > 0) {
      errors.push(`Duplicate field mappings: ${[...new Set(duplicates)].join(', ')}`)
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Process and import contacts
   */
  async processImport(
    importId: string,
    rows: Record<string, string>[],
    mapping: FieldMapping,
    channelId: string,
    organizationId: string
  ): Promise<ImportResult> {
    const errors: ImportError[] = []
    let successCount = 0

    // Get valid stages
    const validStages = ['NEW', 'LEAD', 'QUALIFIED', 'CUSTOMER', 'CHURNED']

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // +2 for header row and 1-based indexing

      try {
        // Extract mapped values
        const contactData: Record<string, unknown> = {}

        for (const [csvColumn, field] of Object.entries(mapping)) {
          if (field === null) continue

          const value = row[csvColumn]?.trim()
          if (!value) continue

          if (field === 'phoneNumber') {
            // Clean phone number - keep only digits and +
            const cleanPhone = value.replace(/[^\d+]/g, '')
            if (!cleanPhone || cleanPhone.length < 10) {
              throw { field: 'phoneNumber', value, error: 'Invalid phone number' }
            }
            contactData.phoneNumber = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`
          } else if (field === 'tags') {
            // Split comma-separated tags
            contactData.tags = value.split(',').map((t) => t.trim()).filter(Boolean)
          } else if (field === 'stage') {
            // Validate stage
            const upperStage = value.toUpperCase()
            if (!validStages.includes(upperStage)) {
              throw { field: 'stage', value, error: `Invalid stage. Must be one of: ${validStages.join(', ')}` }
            }
            contactData.stage = upperStage
          } else if (field === 'email') {
            // Basic email validation
            if (value && !value.includes('@')) {
              throw { field: 'email', value, error: 'Invalid email format' }
            }
            contactData.email = value
          } else {
            contactData[field] = value
          }
        }

        // Ensure phone number exists
        if (!contactData.phoneNumber) {
          throw { field: 'phoneNumber', value: '', error: 'Phone number is required' }
        }

        // Check for existing contact
        const existing = await prisma.contact.findFirst({
          where: {
            phoneNumber: contactData.phoneNumber as string,
            channelId,
          },
        })

        if (existing) {
          // Update existing contact
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              name: (contactData.name as string) || existing.name,
              email: (contactData.email as string) || existing.email,
              segment: (contactData.segment as string) || existing.segment,
              tags: (contactData.tags as string[]) || existing.tags,
              notes: (contactData.notes as string) || existing.notes,
              stage: (contactData.stage as 'NEW' | 'LEAD' | 'QUALIFIED' | 'CUSTOMER' | 'CHURNED') || existing.stage,
            },
          })
        } else {
          // Create new contact
          await prisma.contact.create({
            data: {
              phoneNumber: contactData.phoneNumber as string,
              name: contactData.name as string || null,
              email: contactData.email as string || null,
              segment: contactData.segment as string || null,
              tags: (contactData.tags as string[]) || [],
              notes: contactData.notes as string || null,
              stage: (contactData.stage as 'NEW' | 'LEAD' | 'QUALIFIED' | 'CUSTOMER' | 'CHURNED') || 'NEW',
              channelId,
              organizationId,
            },
          })
        }

        successCount++

        // Update progress periodically
        if (i % 50 === 0) {
          await prisma.contactImport.update({
            where: { id: importId },
            data: {
              processedRows: i + 1,
              successCount,
              errorCount: errors.length,
            },
          })
        }
      } catch (error) {
        const err = error as { field?: string; value?: string; error?: string }
        errors.push({
          row: rowNumber,
          field: err.field || 'unknown',
          value: err.value || '',
          error: err.error || (error instanceof Error ? error.message : 'Unknown error'),
        })
      }
    }

    // Final update
    await prisma.contactImport.update({
      where: { id: importId },
      data: {
        status: 'COMPLETED',
        processedRows: rows.length,
        successCount,
        errorCount: errors.length,
        errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : Prisma.DbNull, // Keep first 100 errors
        completedAt: new Date(),
      },
    })

    return {
      success: true,
      importId,
      totalRows: rows.length,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 100),
    }
  }
}

// Singleton instance
let importService: ContactImportService | null = null

export function getContactImportService(): ContactImportService {
  if (!importService) {
    importService = new ContactImportService()
  }
  return importService
}
