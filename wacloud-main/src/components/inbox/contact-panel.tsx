'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Mail,
  Phone,
  MapPin,
  Tag,
  User,
  Calendar,
  MessageSquare,
  Edit,
  MoreVertical,
  Plus,
  ExternalLink,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { Contact, Conversation } from '@/types'
import { ContactDialog } from '@/components/contacts/contact-dialog'
import { DealsTab } from './deals-tab'


interface ContactPanelProps {
  contact?: Contact | null
  conversation?: Conversation | null
}

const stages = [
  { value: 'NEW', label: 'New', color: 'bg-gray-500' },
  { value: 'LEAD', label: 'Lead', color: 'bg-blue-500' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-yellow-500' },
  { value: 'CUSTOMER', label: 'Customer', color: 'bg-green-500' },
  { value: 'CHURNED', label: 'Churned', color: 'bg-red-500' },
]

interface ContactPanelPropsExtended extends ContactPanelProps {
  onContactUpdate?: () => void
  onClose?: () => void
}

export function ContactPanel({ contact, conversation, onContactUpdate, onClose }: ContactPanelPropsExtended) {
  const [isOpen, setIsOpen] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [notes, setNotes] = useState(contact?.notes || '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isSavingStage, setIsSavingStage] = useState(false)
  const [isSavingAssign, setIsSavingAssign] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string, name: string | null, email: string }>>([])
  const [activities, setActivities] = useState<any[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)

  useEffect(() => {
    setNotes(contact?.notes || '')
  }, [contact?.id, contact?.notes])

  // Fetch team members
  useEffect(() => {
    fetch('/api/team')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setTeamMembers(data.data)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch team members:', err)
      })
  }, [])

  // Fetch activities
  useEffect(() => {
    if (!contact?.id) return

    setIsLoadingActivities(true)
    fetch(`/api/contacts/${contact.id}/activities`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch activities')
        return res.json()
      })
      .then(data => {
        if (data.data) {
          setActivities(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingActivities(false))
  }, [contact?.id])

  // Handle stage change
  const handleStageChange = async (newStage: string) => {
    if (!contact?.id) return
    setIsSavingStage(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (response.ok) {
        toast.success('Stage updated')
      } else {
        toast.error('Failed to update stage')
      }
    } catch (error) {
      toast.error('Failed to update stage')
    } finally {
      setIsSavingStage(false)
    }
  }

  // Handle assignment change
  const handleAssignChange = async (assignedTo: string) => {
    if (!contact?.id) return
    setIsSavingAssign(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assignedTo === 'unassigned' ? null : assignedTo }),
      })
      if (response.ok) {
        toast.success('Assignment updated')
      } else {
        toast.error('Failed to update assignment')
      }
    } catch (error) {
      toast.error('Failed to update assignment')
    } finally {
      setIsSavingAssign(false)
    }
  }

  // Handle save notes
  const handleSaveNotes = async () => {
    if (!contact?.id) return
    setIsSavingNotes(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (response.ok) {
        toast.success('Notes saved')
      } else {
        toast.error('Failed to save notes')
      }
    } catch (error) {
      toast.error('Failed to save notes')
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Handle add tag
  const handleAddTag = async () => {
    if (!contact?.id || !newTag.trim()) return
    setIsSavingTag(true)
    try {
      const currentTags = contact.tags || []
      const updatedTags = [...new Set([...currentTags, newTag.trim()])]
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      })
      if (response.ok) {
        toast.success('Tag added')
        setNewTag('')
      } else {
        toast.error('Failed to add tag')
      }
    } catch (error) {
      toast.error('Failed to add tag')
    } finally {
      setIsSavingTag(false)
    }
  }

  // Handle remove tag
  const handleRemoveTag = async (tagToRemove: string) => {
    if (!contact?.id) return
    try {
      const currentTags = contact.tags || []
      const updatedTags = currentTags.filter(t => t !== tagToRemove)
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      })
      if (response.ok) {
        toast.success('Tag removed')
      } else {
        toast.error('Failed to remove tag')
      }
    } catch (error) {
      toast.error('Failed to remove tag')
    }
  }

  if (!contact) {
    return null
  }

  if (!isOpen) {
    return (
      <div className="flex w-12 flex-col items-center border-l bg-card py-4">
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <User className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  const currentStage = stages.find((s) => s.value === contact.stage)
  const customFields = (contact.customFields as Record<string, string>) || {}

  return (
    <div className="flex h-full flex-col bg-card min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-semibold">Contact Details</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${contact.id}`}>
                  View full profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Export contact</DropdownMenuItem>
              <DropdownMenuItem>View activity log</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => onClose ? onClose() : setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          <div className="p-4">
            {/* Contact info */}
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src={contact.avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {contact.name?.[0] || contact.phoneNumber?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <h4 className="mt-3 text-lg font-semibold">
                {contact.name || contact.phoneNumber}
              </h4>
              <div className="mt-1 flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${currentStage?.color || 'bg-gray-500'}`}
                />
                <span className="text-sm text-muted-foreground">
                  {currentStage?.label || 'New'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">Score: {contact.leadScore || 0}</Badge>
              </div>
              <Link href={`/contacts/${contact.id}`}>
                <Button variant="outline" size="sm" className="mt-3">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Profile
                </Button>
              </Link>
            </div>

            <Separator className="my-4" />

            {/* AI Summary */}
            <div className="mb-4 rounded-lg bg-violet-50 p-3 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
              <div className="flex items-center gap-2 mb-2 text-violet-700 dark:text-violet-400">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">AI Summary</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {contact.notes ?
                  `Based on recent interactions, ${contact.name || 'this contact'} is interested in our premium plans. Key discussion points: ${contact.notes.substring(0, 50)}...` :
                  "No recent interactions to summarize. Start a conversation to generate insights."
                }
              </p>
            </div>

            {/* Quick info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{contact.phoneNumber}</span>
              </div>
              {contact.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.email}</span>
                </div>
              )}
              {customFields.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{customFields.location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Created {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              {contact.lastContactedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Last message{' '}
                    {format(new Date(contact.lastContactedAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Tabs */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="text-xs">
                  Details
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="deals" className="text-xs">
                  Deals
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">
                  Activity
                </TabsTrigger>
              </TabsList>


              <TabsContent value="details" className="mt-4 space-y-4">
                {/* Stage */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Stage</label>
                  <Select
                    defaultValue={contact.stage}
                    onValueChange={handleStageChange}
                    disabled={isSavingStage}
                  >
                    <SelectTrigger>
                      {isSavingStage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                            {stage.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned to */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Assigned to
                  </label>
                  <Select
                    defaultValue={contact.assignedTo || 'unassigned'}
                    onValueChange={handleAssignChange}
                    disabled={isSavingAssign}
                  >
                    <SelectTrigger>
                      {isSavingAssign && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tags</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(contact.tags || []).length === 0 ? (
                      <span className="text-sm text-muted-foreground">No tags</span>
                    ) : (
                      (contact.tags || []).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      className="h-7 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleAddTag}
                      disabled={isSavingTag || !newTag.trim()}
                    >
                      {isSavingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                {/* Custom fields */}
                {Object.keys(customFields).length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Custom Fields
                    </label>
                    <div className="space-y-2 text-sm">
                      {Object.entries(customFields).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">
                            {key}
                          </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Textarea
                  placeholder="Add notes about this contact..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[150px] resize-none"
                />
                <Button
                  className="mt-2 w-full"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Notes
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="deals" className="mt-4 h-[calc(100%-40px)]">
                <DealsTab contact={contact} />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">

                {isLoadingActivities ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No activity recorded yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="h-2 w-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{activity.title}</p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                            </span>
                            {activity.creator && (
                              <span className="text-xs text-muted-foreground">• by {activity.creator.name || activity.creator.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* Edit Contact Dialog */}
      {contact && (
        <ContactDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          contact={{
            id: contact.id,
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            email: contact.email,
            stage: contact.stage,
            segment: contact.segment,
            notes: contact.notes,
            tags: contact.tags || [],
            channel: contact.channel as { id: string; name: string; phoneNumber: string } | undefined,
          }}
          onSuccess={() => {
            setEditDialogOpen(false)
            onContactUpdate?.()
          }}
        />
      )}
    </div>
  )
}
