'use client'

import { useState, useCallback } from 'react'
import { CampaignsList } from '@/components/campaigns/campaigns-list'
import { CampaignDialog } from '@/components/campaigns/campaign-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Campaign {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  replyCount: number
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  channelId?: string
  messageType?: string
  messageContent?: string | null
  targetSegment?: string | null
  targetTags?: string[]
  channel?: {
    id: string
    name: string
    phoneNumber: string
  }
}

export function CampaignsPageContent() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleAddCampaign = () => {
    setEditingCampaign(null)
    setDialogOpen(true)
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setDialogOpen(true)
  }

  const handleSuccess = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Actions bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaigns</h2>
          <p className="text-muted-foreground">
            Create and manage bulk messaging campaigns
          </p>
        </div>

        <Button onClick={handleAddCampaign}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {/* Campaign tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <CampaignsList key={`all-${refreshKey}`} filter="all" onEdit={handleEditCampaign} />
        </TabsContent>
        <TabsContent value="draft" className="mt-6">
          <CampaignsList key={`draft-${refreshKey}`} filter="DRAFT" onEdit={handleEditCampaign} />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-6">
          <CampaignsList key={`scheduled-${refreshKey}`} filter="SCHEDULED" onEdit={handleEditCampaign} />
        </TabsContent>
        <TabsContent value="running" className="mt-6">
          <CampaignsList key={`running-${refreshKey}`} filter="RUNNING" onEdit={handleEditCampaign} />
        </TabsContent>
        <TabsContent value="completed" className="mt-6">
          <CampaignsList key={`completed-${refreshKey}`} filter="COMPLETED" onEdit={handleEditCampaign} />
        </TabsContent>
      </Tabs>

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editingCampaign}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
