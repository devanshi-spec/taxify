'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Loader2, Send, AlertCircle } from 'lucide-react'
import type { MessageTemplate, Contact } from '@/types'

interface TemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: MessageTemplate, variables: Record<string, string>) => void
  contact?: Contact | null
  channelId?: string
}

export function TemplatePicker({
  open,
  onOpenChange,
  onSelect,
  contact,
  channelId,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      fetchTemplates()
      setSelectedTemplate(null)
      setVariables({})
    }
  }, [open])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (channelId) params.append('channelId', channelId)
      params.append('status', 'APPROVED')

      const response = await fetch(`/api/templates?${params}`)
      if (response.ok) {
        const result = await response.json()
        setTemplates(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Extract variables from template body text
  const extractVariables = useCallback((bodyText: string): string[] => {
    const regex = /\{\{(\d+)\}\}/g
    const matches = [...bodyText.matchAll(regex)]
    const uniqueVars = [...new Set(matches.map(m => m[1]))]
    return uniqueVars.sort((a, b) => parseInt(a) - parseInt(b))
  }, [])

  // Pre-fill variables with contact data
  const prefillVariables = useCallback((template: MessageTemplate) => {
    const vars = extractVariables(template.bodyText)
    const prefilled: Record<string, string> = {}

    vars.forEach((v, index) => {
      if (index === 0 && contact?.name) {
        prefilled[v] = contact.name
      } else if (index === 1 && contact?.phoneNumber) {
        prefilled[v] = contact.phoneNumber
      } else {
        prefilled[v] = ''
      }
    })

    return prefilled
  }, [contact, extractVariables])

  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setVariables(prefillVariables(template))
  }

  const handleSendTemplate = () => {
    if (!selectedTemplate) return
    onSelect(selectedTemplate, variables)
    onOpenChange(false)
    setSelectedTemplate(null)
    setVariables({})
  }

  const handleBack = () => {
    setSelectedTemplate(null)
    setVariables({})
  }

  // Preview template with variables replaced
  const getPreviewText = (template: MessageTemplate) => {
    let preview = template.bodyText
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`)
    })
    return preview
  }

  // Filter templates based on search
  const filteredTemplates = templates.filter((template) => {
    const searchLower = search.toLowerCase()
    return (
      template.name.toLowerCase().includes(searchLower) ||
      template.bodyText.toLowerCase().includes(searchLower) ||
      template.category.toLowerCase().includes(searchLower)
    )
  })

  // Group by category
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(template)
    return acc
  }, {} as Record<string, MessageTemplate[]>)

  const templateVars = selectedTemplate ? extractVariables(selectedTemplate.bodyText) : []

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MARKETING': return 'bg-purple-100 text-purple-800'
      case 'UTILITY': return 'bg-blue-100 text-blue-800'
      case 'AUTHENTICATION': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>
            {selectedTemplate ? 'Configure Template' : 'Select Template'}
          </DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          <Command className="border-0">
            <CommandInput
              placeholder="Search templates..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No approved templates found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create templates in Settings to use them here
                  </p>
                </div>
              ) : (
                <>
                  <CommandEmpty>No templates found.</CommandEmpty>
                  {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                    <CommandGroup key={category} heading={category}>
                      {categoryTemplates.map((template) => (
                        <CommandItem
                          key={template.id}
                          value={`${template.name} ${template.category}`}
                          onSelect={() => handleSelectTemplate(template)}
                          className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{template.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {template.language}
                              </Badge>
                              <Badge className={`text-xs ${getCategoryColor(template.category)}`}>
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground pl-6">
                            {template.bodyText}
                          </p>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        ) : (
          <div className="p-4 pt-2 space-y-4">
            {/* Template info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedTemplate.name}</span>
              </div>
              <Badge className={`text-xs ${getCategoryColor(selectedTemplate.category)}`}>
                {selectedTemplate.category}
              </Badge>
            </div>

            {/* Variables input */}
            {templateVars.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Template Variables</Label>
                {templateVars.map((varNum, index) => (
                  <div key={varNum} className="space-y-1">
                    <Label htmlFor={`var-${varNum}`} className="text-xs text-muted-foreground">
                      Variable {parseInt(varNum)} {index === 0 ? '(e.g., Name)' : ''}
                    </Label>
                    <Input
                      id={`var-${varNum}`}
                      value={variables[varNum] || ''}
                      onChange={(e) => setVariables(prev => ({
                        ...prev,
                        [varNum]: e.target.value
                      }))}
                      placeholder={`Enter value for {{${varNum}}}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview</Label>
              <ScrollArea className="h-[120px] rounded-md border bg-muted/50 p-3">
                <p className="text-sm whitespace-pre-wrap">{getPreviewText(selectedTemplate)}</p>
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleSendTemplate}>
                <Send className="h-4 w-4 mr-2" />
                Send Template
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
