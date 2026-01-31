'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Users, Plus, MoreVertical, Mail, Trash2, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface TeamMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: string
  isActive: boolean
  lastLoginAt: string | null
}

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-500',
  ADMIN: 'bg-blue-500',
  MEMBER: 'bg-green-500',
  VIEWER: 'bg-gray-500',
}

export function TeamSettings() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/team')
      if (response.ok) {
        const result = await response.json()
        setMembers(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching team:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address')
      return
    }

    try {
      setInviting(true)
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      if (response.ok) {
        toast.success('Invitation sent successfully')
        setInviteDialogOpen(false)
        setInviteEmail('')
        setInviteRole('MEMBER')
        fetchMembers()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to send invitation')
      }
    } catch (error) {
      toast.error('Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Team member removed')
        fetchMembers()
      } else {
        toast.error('Failed to remove team member')
      }
    } catch (error) {
      toast.error('Failed to remove team member')
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        toast.success('Role updated successfully')
        fetchMembers()
      } else {
        toast.error('Failed to update role')
      }
    } catch (error) {
      toast.error('Failed to update role')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Members</h2>
          <p className="text-muted-foreground">
            Manage your team and their permissions
          </p>
        </div>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Team</CardTitle>
          </div>
          <CardDescription>
            {members.length} team member{members.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No team members yet</p>
              <p className="text-sm text-muted-foreground">
                Invite your first team member to collaborate
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatarUrl || undefined} />
                          <AvatarFallback>
                            {member.name?.[0] || member.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {member.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="flex w-fit items-center gap-1"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${roleColors[member.role] || 'bg-gray-500'}`}
                        />
                        {member.role.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? 'default' : 'secondary'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.role !== 'OWNER' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.id, 'ADMIN')}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.id, 'MEMBER')}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Make Member
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
