'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { IMPORTABLE_FIELDS } from '@/lib/services/import-service'

interface ImportWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId: string
  onSuccess?: () => void
}

interface Preview {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}

interface ImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: Array<{
    row: number
    field: string
    value: string
    error: string
  }>
}

type Step = 'upload' | 'mapping' | 'processing' | 'complete'

export function ImportWizard({ open, onOpenChange, channelId, onSuccess }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [importId, setImportId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const resetWizard = useCallback(() => {
    setStep('upload')
    setLoading(false)
    setImportId(null)
    setPreview(null)
    setMapping({})
    setResult(null)
  }, [])

  const handleClose = () => {
    resetWizard()
    onOpenChange(false)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('channelId', channelId)

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload file')
      }

      const data = await response.json()
      setImportId(data.import.id)
      setPreview(data.preview)
      setMapping(data.mapping)
      setStep('mapping')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingChange = (csvColumn: string, field: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [csvColumn]: field === 'skip' ? null : field,
    }))
  }

  const validateMapping = (): boolean => {
    const mappedFields = Object.values(mapping).filter((v) => v !== null)
    if (!mappedFields.includes('phoneNumber')) {
      toast.error('Phone Number field is required')
      return false
    }

    // Check for duplicates
    const duplicates = mappedFields.filter(
      (item, index) => item !== null && mappedFields.indexOf(item) !== index
    )
    if (duplicates.length > 0) {
      toast.error(`Duplicate mappings: ${[...new Set(duplicates)].join(', ')}`)
      return false
    }

    return true
  }

  const handleSaveMapping = async () => {
    if (!importId || !validateMapping()) return

    try {
      setLoading(true)

      const response = await fetch(`/api/contacts/import/${importId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save mapping')
      }

      // Start processing
      await handleProcess()
    } catch (error) {
      console.error('Mapping error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save mapping')
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!importId) return

    try {
      setStep('processing')

      const response = await fetch(`/api/contacts/import/${importId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }

      const data = await response.json()
      setResult(data.result)
      setStep('complete')
      onSuccess?.()
    } catch (error) {
      console.error('Process error:', error)
      toast.error(error instanceof Error ? error.message : 'Import failed')
      setStep('mapping')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Contacts'}
            {step === 'mapping' && 'Map Fields'}
            {step === 'processing' && 'Processing Import'}
            {step === 'complete' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to import contacts'}
            {step === 'mapping' && 'Map CSV columns to contact fields'}
            {step === 'processing' && 'Your contacts are being imported...'}
            {step === 'complete' && 'Your import has been completed'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(['upload', 'mapping', 'processing', 'complete'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ['upload', 'mapping', 'processing', 'complete'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {['upload', 'mapping', 'processing', 'complete'].indexOf(step) > i ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    ['upload', 'mapping', 'processing', 'complete'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto py-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p>Uploading and analyzing file...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    Drag and drop your CSV file here
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-upload"
                  />
                  <Button asChild>
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Select File
                    </label>
                  </Button>
                  <div className="mt-6 text-left max-w-md mx-auto">
                    <p className="text-sm font-medium mb-2">CSV Requirements:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>- First row should contain column headers</li>
                      <li>- Phone numbers must include country code (e.g., +1234567890)</li>
                      <li>- Tags should be comma-separated within the cell</li>
                      <li>- UTF-8 encoding recommended</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {preview.totalRows} rows. Map your CSV columns to contact fields.
                </p>
                <Badge variant="secondary">
                  {Object.values(mapping).filter((v) => v !== null).length} fields mapped
                </Badge>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">CSV Column</TableHead>
                      <TableHead className="w-[200px]">Map to Field</TableHead>
                      <TableHead>Preview (first 3 rows)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.headers.map((header) => (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={mapping[header] || 'skip'}
                            onValueChange={(value) => handleMappingChange(header, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Skip" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">
                                <span className="text-muted-foreground">-- Skip --</span>
                              </SelectItem>
                              {IMPORTABLE_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                  {field.required && (
                                    <span className="text-destructive ml-1">*</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {preview.rows.slice(0, 3).map((row, i) => (
                              <span key={i} className="truncate max-w-[100px]">
                                {row[header] || '-'}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Required Fields</p>
                <div className="flex gap-2 flex-wrap">
                  {IMPORTABLE_FIELDS.filter((f) => f.required).map((field) => {
                    const isMapped = Object.values(mapping).includes(field.value)
                    return (
                      <Badge
                        key={field.value}
                        variant={isMapped ? 'default' : 'destructive'}
                      >
                        {isMapped ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {field.label}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Importing contacts...</p>
              <p className="text-sm text-muted-foreground mb-4">
                This may take a few moments
              </p>
              <Progress value={50} className="w-64" />
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && result && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                {result.errorCount === 0 ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                ) : result.successCount > 0 ? (
                  <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
                ) : (
                  <XCircle className="h-16 w-16 text-destructive mb-4" />
                )}
                <h3 className="text-xl font-semibold mb-2">
                  {result.errorCount === 0
                    ? 'Import Successful!'
                    : result.successCount > 0
                    ? 'Import Completed with Errors'
                    : 'Import Failed'}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{result.totalRows}</p>
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.successCount}</p>
                  <p className="text-sm text-muted-foreground">Imported</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{result.errorCount}</p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Row</TableHead>
                        <TableHead className="w-[100px]">Field</TableHead>
                        <TableHead className="w-[100px]">Value</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, i) => (
                        <TableRow key={i}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell>{error.field}</TableCell>
                          <TableCell className="truncate max-w-[100px]">
                            {error.value || '-'}
                          </TableCell>
                          <TableCell className="text-destructive text-sm">
                            {error.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSaveMapping} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Start Import
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <>
              <Button variant="outline" onClick={resetWizard}>
                Import Another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
