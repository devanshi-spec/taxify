'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Upload, Download, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContactsTable } from './contacts-table'
import { ContactFilters } from './contact-filters'
import { ContactDialog } from './contact-dialog'
import { ImportWizard } from './import-wizard'

interface Channel {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string | null
  phoneNumber: string
  email: string | null
  avatarUrl: string | null
  stage: string
  leadScore: number
  tags: string[]
  isOptedIn: boolean
  lastContactedAt: string | null
  createdAt: string
  segment?: string | null
  notes?: string | null
  channel?: {
    id: string
    name: string
    phoneNumber: string
  }
  _count?: {
    conversations: number
  }
}

export function ContactsPageContent() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedImportChannel, setSelectedImportChannel] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    // Fetch channels for import
    fetch('/api/channels')
      .then((res) => res.json())
      .then((data) => {
        setChannels(data.data || [])
      })
      .catch(console.error)
  }, [])

  const handleImport = (channelId: string) => {
    setSelectedImportChannel(channelId)
    setImportOpen(true)
  }

  const handleAddContact = () => {
    setEditingContact(null)
    setDialogOpen(true)
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setDialogOpen(true)
  }

  const handleSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleExport = async () => {
    try {
      setExporting(true)
      const response = await fetch('/api/contacts?limit=10000')
      if (!response.ok) throw new Error('Failed to fetch contacts')

      const result = await response.json()
      const contacts = result.data || []

      if (contacts.length === 0) {
        toast.error('No contacts to export')
        return
      }

      // Create CSV content
      const headers = ['Name', 'Phone Number', 'Email', 'Stage', 'Tags', 'Segment', 'Opted In', 'Created At']
      const rows = contacts.map((contact: Contact) => [
        contact.name || '',
        contact.phoneNumber,
        contact.email || '',
        contact.stage,
        contact.tags?.join('; ') || '',
        contact.segment || '',
        contact.isOptedIn ? 'Yes' : 'No',
        new Date(contact.createdAt).toLocaleDateString(),
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row: string[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${contacts.length} contacts`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export contacts')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Actions bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contacts</h2>
          <p className="text-muted-foreground">
            Manage your WhatsApp contacts and segments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {channels.length === 0 ? (
                <DropdownMenuItem disabled>No channels available</DropdownMenuItem>
              ) : (
                channels.map((channel) => (
                  <DropdownMenuItem
                    key={channel.id}
                    onClick={() => handleImport(channel.id)}
                  >
                    Import to {channel.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button size="sm" onClick={handleAddContact}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ContactFilters />

      {/* Contacts table */}
      <ContactsTable key={refreshKey} onEdit={handleEditContact} />

      {/* Add/Edit Dialog */}
      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        onSuccess={handleSuccess}
      />

      {/* Import Wizard */}
      {selectedImportChannel && (
        <ImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          channelId={selectedImportChannel}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
