'use client'

import { useState, useEffect } from 'react'
import { Loader2, Users, User, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface TeamMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: string
  isActive: boolean
}

interface AssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  currentAssignee?: string | null
  onAssigned?: (agentId: string) => void
}

export function AssignDialog({
  open,
  onOpenChange,
  conversationId,
  currentAssignee,
  onAssigned,
}: AssignDialogProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string | null>(currentAssignee || null)

  useEffect(() => {
    if (open) {
      fetchTeamMembers()
      setSelectedMember(currentAssignee || null)
    }
  }, [open, currentAssignee])

  const fetchTeamMembers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/team')
      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error)
      toast.error('Failed to load team members')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedMember) {
      toast.error('Please select a team member')
      return
    }

    setIsAssigning(true)
    try {
      const response = await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedMember }),
      })

      if (response.ok) {
        const assignedMember = teamMembers.find(m => m.id === selectedMember)
        toast.success(`Assigned to ${assignedMember?.name || assignedMember?.email}`)
        onAssigned?.(selectedMember)
        onOpenChange(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to assign conversation')
      }
    } catch (error) {
      console.error('Failed to assign:', error)
      toast.error('Failed to assign conversation')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassign = async () => {
    setIsAssigning(true)
    try {
      const response = await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Conversation unassigned')
        setSelectedMember(null)
        onAssigned?.('')
        onOpenChange(false)
      } else {
        toast.error('Failed to unassign conversation')
      }
    } catch (error) {
      console.error('Failed to unassign:', error)
      toast.error('Failed to unassign conversation')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Conversation
          </DialogTitle>
          <DialogDescription>
            Select a team member to handle this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2" />
              <p>No team members found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <RadioGroup value={selectedMember || ''} onValueChange={setSelectedMember}>
                {teamMembers
                  .filter(m => m.isActive)
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedMember(member.id)}
                    >
                      <RadioGroupItem value={member.id} id={member.id} />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback>
                          {member.name?.[0] || member.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                        <p className="font-medium">{member.name || member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </Label>
                      {currentAssignee === member.id && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                    </div>
                  ))}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          {currentAssignee && (
            <Button
              variant="outline"
              onClick={handleUnassign}
              disabled={isAssigning}
            >
              Unassign
            </Button>
          )}
          <Button
            onClick={handleAssign}
            disabled={isAssigning || !selectedMember || selectedMember === currentAssignee}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Assign
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
