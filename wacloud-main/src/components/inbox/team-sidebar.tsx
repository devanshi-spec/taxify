'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Loader2, Circle, Users, ChevronRight, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Agent {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE'
  maxConcurrentChats: number
  currentLoad: number
  skills: string[]
  languages: string[]
  metrics?: {
    activeChats: number
    todayAssignments: number
  }
}

interface TeamSidebarProps {
  currentUserId?: string
  onAgentClick?: (agentId: string) => void
  selectedAgentId?: string | null
}

const statusColors = {
  ONLINE: 'bg-green-500',
  AWAY: 'bg-yellow-500',
  BUSY: 'bg-red-500',
  OFFLINE: 'bg-gray-400',
}

const statusLabels = {
  ONLINE: 'Online',
  AWAY: 'Away',
  BUSY: 'Busy',
  OFFLINE: 'Offline',
}

export function TeamSidebar({
  currentUserId,
  onAgentClick,
  selectedAgentId,
}: TeamSidebarProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [myStatus, setMyStatus] = useState<Agent['status']>('OFFLINE')
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents?includeMetrics=true')
      if (response.ok) {
        const result = await response.json()
        setAgents(result.data || [])

        // Set my current status
        const myAgent = result.data?.find((a: Agent) => a.id === currentUserId)
        if (myAgent) {
          setMyStatus(myAgent.status)
        }
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchAgents()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAgents, 30000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  const handleStatusChange = async (newStatus: Agent['status']) => {
    if (!currentUserId) return

    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/agents/${currentUserId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      setMyStatus(newStatus)
      setStatusPopoverOpen(false)
      fetchAgents()
      toast.success(`Status changed to ${statusLabels[newStatus]}`)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const myAgent = agents.find((a) => a.id === currentUserId)
  const otherAgents = agents.filter((a) => a.id !== currentUserId)

  if (loading) {
    return (
      <div className="w-64 border-l bg-card p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-64 border-l bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5" />
          <span className="font-semibold">Team</span>
          <Badge variant="secondary" className="ml-auto">
            {agents.filter((a) => a.status === 'ONLINE').length} online
          </Badge>
        </div>

        {/* My Status */}
        {myAgent && (
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={myAgent.image || undefined} />
                  <AvatarFallback>
                    {getInitials(myAgent.name, myAgent.email)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
                    statusColors[myStatus]
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {myAgent.name || 'You'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {myAgent.currentLoad}/{myAgent.maxConcurrentChats} chats
                </p>
              </div>
              <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" align="end">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Set your status
                    </Label>
                    {(
                      Object.keys(statusLabels) as Array<keyof typeof statusLabels>
                    ).map((status) => (
                      <Button
                        key={status}
                        variant={myStatus === status ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => handleStatusChange(status)}
                        disabled={updatingStatus}
                      >
                        <Circle
                          className={cn(
                            'h-3 w-3 mr-2 fill-current',
                            statusColors[status].replace('bg-', 'text-')
                          )}
                        />
                        {statusLabels[status]}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          {otherAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onAgentClick?.(agent.id)}
              className={cn(
                'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left',
                selectedAgentId === agent.id && 'bg-accent'
              )}
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={agent.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(agent.name, agent.email)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
                    statusColors[agent.status]
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {agent.name || agent.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {agent.metrics?.activeChats || 0} active chats
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}

          {otherAgents.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No other team members
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 border-t">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-muted rounded-lg p-2">
            <p className="text-lg font-bold">
              {agents.reduce((sum, a) => sum + (a.metrics?.activeChats || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <p className="text-lg font-bold">
              {agents.reduce((sum, a) => sum + (a.metrics?.todayAssignments || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
        </div>
      </div>
    </div>
  )
}
