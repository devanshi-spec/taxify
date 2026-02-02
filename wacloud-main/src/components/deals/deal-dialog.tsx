'use client'

import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Check, ChevronsUpDown, Calendar as CalendarIcon, Trash2, User, UserX } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  name: string
  color: string
  probability: number
}

interface Contact {
  id: string
  name: string | null
  phoneNumber: string
  avatarUrl: string | null
}

interface TeamMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: string
}

interface Deal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  contact: Contact
  assignedTo: string | null
  assignedUser?: TeamMember | null
}

interface DealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  stages: Stage[]
  defaultStage?: string | null
  defaultContactId?: string | null
  deal?: Deal | null
  onSuccess?: () => void
}

export function DealDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  defaultStage,
  defaultContactId,
  deal,
  onSuccess,
}: DealDialogProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamMembersLoading, setTeamMembersLoading] = useState(false)
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    value: '',
    currency: 'USD',
    stage: '',
    contactId: '',
    assignedTo: '' as string | null,
    expectedCloseDate: null as Date | null,
  })

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [selectedAssignee, setSelectedAssignee] = useState<TeamMember | null>(null)

  useEffect(() => {
    if (open) {
      // Fetch team members when dialog opens
      fetchTeamMembers()

      if (deal) {
        setFormData({
          title: deal.title,
          value: deal.value.toString(),
          currency: deal.currency,
          stage: deal.stage,
          contactId: deal.contact.id,
          assignedTo: deal.assignedTo,
          expectedCloseDate: deal.expectedCloseDate
            ? new Date(deal.expectedCloseDate)
            : null,
        })
        setSelectedContact(deal.contact)
        setSelectedAssignee(deal.assignedUser || null)
      } else {
        setFormData({
          title: '',
          value: '',
          currency: 'USD',
          stage: defaultStage || stages[0]?.id || '',
          contactId: defaultContactId || '',
          assignedTo: null,
          expectedCloseDate: null,
        })
        setSelectedContact(null)
        setSelectedAssignee(null)

        // Fetch default contact if provided
        if (defaultContactId) {
          fetchDefaultContact(defaultContactId)
        }
      }
    }
  }, [open, deal, defaultStage, defaultContactId, stages])

  const fetchDefaultContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`)
      if (response.ok) {
        const result = await response.json()
        const contact = result.data
        setSelectedContact({
          id: contact.id,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          avatarUrl: contact.avatarUrl,
        })
      }
    } catch (error) {
      console.error('Error fetching default contact:', error)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      setTeamMembersLoading(true)
      const response = await fetch('/api/team')
      if (response.ok) {
        const result = await response.json()
        setTeamMembers(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
    } finally {
      setTeamMembersLoading(false)
    }
  }

  const fetchContacts = async (search?: string) => {
    try {
      setContactsLoading(true)
      const params = new URLSearchParams({ limit: '20' })
      if (search) params.set('search', search)
      const response = await fetch(`/api/contacts?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setContacts(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setContactsLoading(false)
    }
  }

  // Load contacts when popover opens
  useEffect(() => {
    if (contactPopoverOpen && contacts.length === 0) {
      fetchContacts()
    }
  }, [contactPopoverOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.contactId) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)

      const payload = {
        title: formData.title,
        value: parseFloat(formData.value) || 0,
        currency: formData.currency,
        stage: formData.stage,
        contactId: formData.contactId,
        assignedTo: formData.assignedTo || null,
        pipelineId,
        expectedCloseDate: formData.expectedCloseDate?.toISOString() || null,
      }

      const url = deal ? `/api/deals/${deal.id}` : '/api/deals'
      const method = deal ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save deal')
      }

      toast.success(deal ? 'Deal updated' : 'Deal created')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving deal:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save deal')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deal) return

    try {
      setDeleting(true)

      const response = await fetch(`/api/deals/${deal.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete deal')
      }

      toast.success('Deal deleted')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error deleting deal:', error)
      toast.error('Failed to delete deal')
    } finally {
      setDeleting(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{deal ? 'Edit Deal' : 'Create Deal'}</DialogTitle>
          <DialogDescription>
            {deal ? 'Update deal details' : 'Add a new deal to your pipeline'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Website redesign project"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, currency: value }))
                    }
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">$</SelectItem>
                      <SelectItem value="EUR">€</SelectItem>
                      <SelectItem value="GBP">£</SelectItem>
                      <SelectItem value="INR">₹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="value"
                    type="number"
                    placeholder="0"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, value: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, stage: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contact *</Label>
              <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={!!deal}
                  >
                    {selectedContact ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={selectedContact.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(selectedContact.name)}
                          </AvatarFallback>
                        </Avatar>
                        {selectedContact.name || selectedContact.phoneNumber}
                      </div>
                    ) : (
                      'Select contact...'
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search contacts..."
                      onValueChange={(value) => fetchContacts(value)}
                    />
                    <CommandList>
                      {contactsLoading ? (
                        <div className="p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : (
                        <>
                          <CommandEmpty>
                            {contacts.length === 0 ? 'No contacts in your account. Add contacts first.' : 'No contacts found. Try a different search.'}
                          </CommandEmpty>
                          <CommandGroup>
                            {contacts.map((contact) => (
                              <CommandItem
                                key={contact.id}
                                value={contact.id}
                                onSelect={() => {
                                  setSelectedContact(contact)
                                  setFormData((prev) => ({
                                    ...prev,
                                    contactId: contact.id,
                                  }))
                                  setContactPopoverOpen(false)
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={contact.avatarUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(contact.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">
                                      {contact.name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {contact.phoneNumber}
                                    </div>
                                  </div>
                                </div>
                                {formData.contactId === contact.id && (
                                  <Check className="h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Close Date</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.expectedCloseDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expectedCloseDate
                        ? format(formData.expectedCloseDate, 'PPP')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.expectedCloseDate || undefined}
                      onSelect={(date) => {
                        setFormData((prev) => ({ ...prev, expectedCloseDate: date || null }))
                        setCalendarOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedAssignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={selectedAssignee.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(selectedAssignee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{selectedAssignee.name || selectedAssignee.email}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Unassigned</span>
                        </div>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0">
                    <Command>
                      <CommandInput placeholder="Search team members..." />
                      <CommandList>
                        {teamMembersLoading ? (
                          <div className="p-4 text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>
                              {teamMembers.length === 0 ? 'No team members found. Invite team members first.' : 'No matches found.'}
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="unassigned"
                                onSelect={() => {
                                  setSelectedAssignee(null)
                                  setFormData((prev) => ({ ...prev, assignedTo: null }))
                                  setAssigneePopoverOpen(false)
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <UserX className="h-4 w-4 text-muted-foreground" />
                                  <span>Unassigned</span>
                                </div>
                                {!formData.assignedTo && <Check className="h-4 w-4" />}
                              </CommandItem>
                              {teamMembers.map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={member.name || member.email}
                                  onSelect={() => {
                                    setSelectedAssignee(member)
                                    setFormData((prev) => ({ ...prev, assignedTo: member.id }))
                                    setAssigneePopoverOpen(false)
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={member.avatarUrl || undefined} />
                                      <AvatarFallback className="text-xs">
                                        {getInitials(member.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">
                                        {member.name || 'Unnamed'}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {member.role}
                                      </div>
                                    </div>
                                  </div>
                                  {formData.assignedTo === member.id && <Check className="h-4 w-4" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {deal && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || deleting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || deleting}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {deal ? 'Updating...' : 'Creating...'}
                </>
              ) : deal ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
