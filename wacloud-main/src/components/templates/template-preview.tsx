'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MessageSquare, Image, FileText, Link, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
    text: string
    url?: string
    phone_number?: string
  }>
}

interface Template {
  id: string
  name: string
  language: string
  category: string
  status: string
  components?: TemplateComponent[]
  // Database format fields
  headerType?: string | null
  headerContent?: string | null
  bodyText?: string
  footerText?: string | null
  buttons?: unknown
}

interface TemplatePreviewProps {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplatePreview({
  template,
  open,
  onOpenChange,
}: TemplatePreviewProps) {
  if (!template) return null

  // Convert database format to components format if needed
  const components: TemplateComponent[] = template.components || []

  // If no components array, build from individual fields
  let headerComponent: TemplateComponent | undefined
  let bodyComponent: TemplateComponent | undefined
  let footerComponent: TemplateComponent | undefined
  let buttonsComponent: TemplateComponent | undefined

  if (components.length > 0) {
    // Use components array (Meta API format)
    headerComponent = components.find((c) => c.type === 'HEADER')
    bodyComponent = components.find((c) => c.type === 'BODY')
    footerComponent = components.find((c) => c.type === 'FOOTER')
    buttonsComponent = components.find((c) => c.type === 'BUTTONS')
  } else {
    // Use individual fields (database format)
    if (template.headerType || template.headerContent) {
      headerComponent = {
        type: 'HEADER',
        format: (template.headerType as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT') || 'TEXT',
        text: template.headerContent || undefined,
      }
    }

    if (template.bodyText) {
      bodyComponent = {
        type: 'BODY',
        text: template.bodyText,
      }
    }

    if (template.footerText) {
      footerComponent = {
        type: 'FOOTER',
        text: template.footerText,
      }
    }

    if (template.buttons && Array.isArray(template.buttons)) {
      buttonsComponent = {
        type: 'BUTTONS',
        buttons: template.buttons as TemplateComponent['buttons'],
      }
    }
  }

  const formatText = (text: string) => {
    // Replace variables with styled placeholders
    return text.replace(/\{\{(\d+)\}\}/g, (_, num) => `{{${num}}}`)
  }

  // Check if any component has variables
  const hasVariables = [headerComponent, bodyComponent, footerComponent].some(
    (c) => c?.text?.includes('{{')
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {template.name}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{template.category}</Badge>
              <Badge variant="secondary">{template.language.toUpperCase()}</Badge>
              <Badge
                variant={template.status === 'APPROVED' ? 'default' : 'secondary'}
                className={cn(
                  template.status === 'APPROVED' && 'bg-green-500',
                  template.status === 'REJECTED' && 'bg-red-500',
                  template.status === 'PENDING' && 'bg-yellow-500'
                )}
              >
                {template.status}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* WhatsApp-style Preview */}
        <div className="bg-[#e5ddd5] rounded-lg p-4">
          <div className="max-w-[320px] mx-auto">
            {/* Message Bubble */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Header */}
              {headerComponent && (
                <div className="border-b">
                  {headerComponent.format === 'IMAGE' ? (
                    <div className="bg-gray-100 h-32 flex items-center justify-center">
                      <Image className="h-12 w-12 text-gray-400" />
                    </div>
                  ) : headerComponent.format === 'VIDEO' ? (
                    <div className="bg-gray-100 h-32 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-gray-400" />
                    </div>
                  ) : headerComponent.format === 'DOCUMENT' ? (
                    <div className="bg-gray-100 p-4 flex items-center gap-3">
                      <FileText className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-600">Document</span>
                    </div>
                  ) : headerComponent.text ? (
                    <div className="p-3 font-semibold text-sm">
                      {formatText(headerComponent.text)}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Body */}
              {bodyComponent?.text && (
                <div className="p-3">
                  <p className="text-sm whitespace-pre-wrap">
                    {formatText(bodyComponent.text)}
                  </p>
                </div>
              )}

              {/* Footer */}
              {footerComponent?.text && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-gray-500">{footerComponent.text}</p>
                </div>
              )}

              {/* Timestamp */}
              <div className="px-3 pb-2 text-right">
                <span className="text-[10px] text-gray-400">12:00 PM</span>
              </div>

              {/* Buttons */}
              {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                <div className="border-t divide-y">
                  {buttonsComponent.buttons.map((button, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-center gap-2 py-2.5 text-[#00a884] font-medium text-sm"
                    >
                      {button.type === 'URL' && <Link className="h-4 w-4" />}
                      {button.type === 'PHONE_NUMBER' && <Phone className="h-4 w-4" />}
                      {button.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Variables Info */}
        {hasVariables && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Variables</h4>
              <div className="text-sm text-muted-foreground">
                <p>This template contains variables that must be replaced when sending:</p>
                <ul className="list-disc list-inside mt-2">
                  {[headerComponent, bodyComponent, footerComponent].map((component) => {
                    if (!component?.text) return null
                    const matches = component.text.match(/\{\{(\d+)\}\}/g)
                    if (!matches) return null
                    return matches.map((match, i) => (
                      <li key={`${component.type}-${i}`}>
                        <code className="bg-muted px-1 rounded">{match}</code> in{' '}
                        {component.type.toLowerCase()}
                      </li>
                    ))
                  })}
                </ul>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
