import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/server'
import { FlowEditorWrapper } from '@/components/flow-editor/flow-editor-wrapper'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'

interface FlowEditorPageProps {
  params: Promise<{ id: string }>
}

export default async function FlowEditorPage({ params }: FlowEditorPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userProfile = {
    name: user?.user_metadata?.name || null,
    email: user?.email || '',
    avatarUrl: user?.user_metadata?.avatar_url || null,
  }

  // Fetch chatbot
  const chatbot = await prisma.chatbot.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      flowData: true,
    },
  })

  if (!chatbot) {
    notFound()
  }

  return (
    <div className="flex h-screen flex-col">
      <Header user={userProfile} title={`Flow Editor - ${chatbot.name}`} />
      <FlowEditorWrapper
        chatbotId={chatbot.id}
        chatbotName={chatbot.name}
        initialFlowData={chatbot.flowData as Record<string, unknown> | null}
      />
    </div>
  )
}
