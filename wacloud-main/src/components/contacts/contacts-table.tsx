'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MoreVertical,
  MessageSquare,
  Tag,
  Trash2,
  Edit,
  Phone,
  Mail,
  Loader2,
  User,
  X,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

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
  channel?: {
    id: string
    name: string
    phoneNumber: string
  }
  _count?: {
    conversations: number
  }
}

interface ContactsResponse {
  data: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const stageColors: Record<string, string> = {
  NEW: 'bg-gray-500',
  LEAD: 'bg-blue-500',
  QUALIFIED: 'bg-yellow-500',
  CUSTOMER: 'bg-green-500',
  CHURNED: 'bg-red-500',
}

interface ContactsTableProps {
  onEdit?: (contact: Contact) => void
}

export function ContactsTable({ onEdit }: ContactsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Tag management state
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagContactId, setTagContactId] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [savingTag, setSavingTag] = useState(false)
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)

  // Segment assignment state
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false)
  const [newSegment, setNewSegment] = useState('')
  const [savingSegment, setSavingSegment] = useState(false)

  const fetchContacts = async () => {
    try {
      setLoading(true)
      // Build query from URL params
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '20')

      // Add filters from URL
      const search = searchParams.get('search')
      const stage = searchParams.get('stage')
      const segment = searchParams.get('segment')
      const tags = searchParams.get('tags')
      const isOptedIn = searchParams.get('isOptedIn')

      if (search) params.set('search', search)
      if (stage) params.set('stage', stage)
      if (segment) params.set('segment', segment)
      if (tags) params.set('tags', tags)
      if (isOptedIn) params.set('isOptedIn', isOptedIn)

      const response = await fetch(`/api/contacts?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }
      const result: ContactsResponse = await response.json()
      setContacts(result.data)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  // Fetch when page or URL params change
  useEffect(() => {
    fetchContacts()
  }, [page, searchParams.toString()])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchParams.toString()])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.length === contacts.length ? [] : contacts.map((c) => c.id)
    )
  }

  const handleDelete = async () => {
    if (!deleteContactId) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/contacts/${deleteContactId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      toast.success('Contact deleted successfully')
      setDeleteContactId(null)
      fetchContacts()
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast.error('Failed to delete contact')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        )
      )
      toast.success(`${selectedIds.length} contacts deleted`)
      setSelectedIds([])
      fetchContacts()
    } catch (error) {
      console.error('Error deleting contacts:', error)
      toast.error('Failed to delete some contacts')
    }
  }

  // Navigate to contact profile
  const handleViewProfile = (contactId: string) => {
    router.push(`/contacts/${contactId}`)
  }

  // Start a conversation with contact
  const handleSendMessage = (contact: Contact) => {
    // Navigate to inbox with this contact selected
    // For now, show a toast - can be enhanced to create/open conversation
    toast.info(`Opening conversation with ${contact.name || contact.phoneNumber}`)
    router.push('/inbox')
  }

  // Open tag management dialog for single contact
  const handleManageTags = (contact: Contact) => {
    setTagContactId(contact.id)
    setNewTag('')
    setTagDialogOpen(true)
  }

  // Add tag to a contact
  const handleAddTag = async () => {
    if (!tagContactId || !newTag.trim()) return

    const contact = contacts.find(c => c.id === tagContactId)
    if (!contact) return

    setSavingTag(true)
    try {
      const updatedTags = [...new Set([...contact.tags, newTag.trim()])]
      const response = await fetch(`/api/contacts/${tagContactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      })

      if (response.ok) {
        toast.success('Tag added')
        setNewTag('')
        fetchContacts()
      } else {
        toast.error('Failed to add tag')
      }
    } catch (error) {
      toast.error('Failed to add tag')
    } finally {
      setSavingTag(false)
    }
  }

  // Remove tag from contact
  const handleRemoveTag = async (contactId: string, tagToRemove: string) => {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return

    try {
      const updatedTags = contact.tags.filter(t => t !== tagToRemove)
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      })

      if (response.ok) {
        toast.success('Tag removed')
        fetchContacts()
      } else {
        toast.error('Failed to remove tag')
      }
    } catch (error) {
      toast.error('Failed to remove tag')
    }
  }

  // Bulk add tag
  const handleBulkAddTag = async () => {
    if (!newTag.trim() || selectedIds.length === 0) return

    setSavingTag(true)
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const contact = contacts.find(c => c.id === id)
          if (contact) {
            const updatedTags = [...new Set([...contact.tags, newTag.trim()])]
            await fetch(`/api/contacts/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tags: updatedTags }),
            })
          }
        })
      )
      toast.success(`Tag added to ${selectedIds.length} contacts`)
      setBulkTagDialogOpen(false)
      setNewTag('')
      setSelectedIds([])
      fetchContacts()
    } catch (error) {
      toast.error('Failed to add tags')
    } finally {
      setSavingTag(false)
    }
  }

  // Bulk assign to segment
  const handleBulkAssignSegment = async () => {
    if (!newSegment.trim() || selectedIds.length === 0) return

    setSavingSegment(true)
    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: selectedIds,
          segment: newSegment.trim(),
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || `${selectedIds.length} contacts added to segment`)
        setSegmentDialogOpen(false)
        setNewSegment('')
        setSelectedIds([])
        fetchContacts()
      } else {
        throw new Error('Failed to assign segment')
      }
    } catch (error) {
      toast.error('Failed to assign segment')
    } finally {
      setSavingSegment(false)
    }
  }

  // Get the current contact being tagged
  const tagContact = tagContactId ? contacts.find(c => c.id === tagContactId) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Phone className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No contacts yet</h3>
        <p className="text-sm text-muted-foreground">
          Add your first contact to get started
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} contact(s) selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSegmentDialogOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                Add to Segment
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkTagDialogOpen(true)}>
                <Tag className="mr-2 h-4 w-4" />
                Add Tag
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                toast.info('Opening inbox to send messages')
                router.push('/inbox')
              }}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Message
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(contact.id)}
                    onCheckedChange={() => toggleSelect(contact.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={contact.avatarUrl || undefined} />
                      <AvatarFallback>
                        {contact.name?.[0] || contact.phoneNumber[1]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {contact.name || 'Unknown'}
                      </div>
                      {contact.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {contact.phoneNumber}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="flex w-fit items-center gap-1"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${stageColors[contact.stage] || 'bg-gray-500'}`}
                    />
                    {contact.stage.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${contact.leadScore}%` }}
                      />
                    </div>
                    <span className="text-sm">{contact.leadScore}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.length > 0 ? (
                      contact.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                    {contact.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{contact.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {contact.lastContactedAt ? (
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(contact.lastContactedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={contact.isOptedIn ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {contact.isOptedIn ? 'Opted In' : 'Opted Out'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewProfile(contact.id)}>
                        <User className="mr-2 h-4 w-4" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendMessage(contact)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send Message
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(contact)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Contact
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleManageTags(contact)}>
                        <Tag className="mr-2 h-4 w-4" />
                        Manage Tags
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteContactId(contact.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total} contacts
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tag management dialog for single contact */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add or remove tags for {tagContact?.name || tagContact?.phoneNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current tags */}
            <div>
              <Label className="text-sm font-medium">Current Tags</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tagContact?.tags.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No tags</span>
                ) : (
                  tagContact?.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tagContact.id, tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Add new tag */}
            <div>
              <Label htmlFor="new-tag">Add New Tag</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="new-tag"
                  placeholder="Enter tag name"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag} disabled={savingTag || !newTag.trim()}>
                  {savingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk tag dialog */}
      <Dialog open={bulkTagDialogOpen} onOpenChange={setBulkTagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tag to Selected Contacts</DialogTitle>
            <DialogDescription>
              Add a tag to {selectedIds.length} selected contact(s)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-tag">Tag Name</Label>
            <Input
              id="bulk-tag"
              placeholder="Enter tag name"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAddTag} disabled={savingTag || !newTag.trim()}>
              {savingTag ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk segment dialog */}
      <Dialog open={segmentDialogOpen} onOpenChange={setSegmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Segment</DialogTitle>
            <DialogDescription>
              Add {selectedIds.length} selected contact(s) to a segment for targeted campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-segment">Segment Name</Label>
            <Input
              id="bulk-segment"
              placeholder="e.g., VIP Customers, Hot Leads"
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleBulkAssignSegment()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssignSegment} disabled={savingSegment || !newSegment.trim()}>
              {savingSegment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add to Segment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
