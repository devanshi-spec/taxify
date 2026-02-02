'use client'

import { useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { ConversationList } from './conversation-list'
import { ChatPanel } from './chat-panel'
import { ContactPanel } from './contact-panel'
import { useConversationStore } from '@/stores/conversation-store'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/types'

interface InboxWrapperProps {
  userId: string
  userName: string | null
  organizationId?: string
}

export function InboxWrapper({ userId, userName, organizationId }: InboxWrapperProps) {
  const [showContactPanel, setShowContactPanel] = useState(true)
  const { selectedConversation } = useConversationStore()

  const handleSelectConversation = (conversation: Conversation) => {
    // Conversation is already selected in the store by ConversationList
  }

  return (
    <div className="flex w-full h-full overflow-hidden bg-muted/40 relative">
      {/* Conversation List - Fixed width, full height, independent scroll */}
      <div className="w-80 min-w-[20rem] flex-shrink-0 flex flex-col border-r bg-background/95 backdrop-blur shadow-sm overflow-hidden min-h-0">
        <ConversationList
          organizationId={organizationId}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Chat Panel - Flexible width, full height, independent scroll */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden min-h-0">
        <div className={cn(
          "flex-1 flex flex-col bg-background overflow-hidden min-h-0",
          !selectedConversation && "items-center justify-center opacity-50 bg-muted/30"
        )}>
          <ChatPanel
            conversation={selectedConversation}
            contact={selectedConversation?.contact}
            userId={userId}
            userName={userName || undefined}
          />
        </div>
      </div>

      {/* Toggle Button for Contact Panel - Mobile only */}
      {selectedConversation && (
        <div className="absolute top-20 right-6 z-30 lg:hidden">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setShowContactPanel(!showContactPanel)}
                  className="shadow-md rounded-full h-10 w-10 bg-background border"
                >
                  {showContactPanel ? (
                    <PanelRightClose className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showContactPanel ? 'Hide contact details' : 'Show contact details'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Contact Details Panel - Fixed width, full height, independent scroll */}
      {selectedConversation && (
        <div className={cn(
          "w-80 flex-shrink-0 bg-background border-l shadow-lg transition-all duration-300 ease-in-out overflow-hidden min-h-0",
          // Desktop: always visible when showContactPanel is true
          "hidden lg:flex lg:flex-col",
          showContactPanel ? "lg:flex" : "lg:hidden",
          // Mobile: overlay with proper positioning
          "absolute lg:static right-0 top-0 h-full z-40 lg:z-auto",
          showContactPanel ? "flex flex-col" : "hidden"
        )}>
          <ContactPanel
            contact={selectedConversation.contact}
            conversation={selectedConversation}
            onClose={() => setShowContactPanel(false)}
          />
        </div>
      )}
    </div>
  )
}
