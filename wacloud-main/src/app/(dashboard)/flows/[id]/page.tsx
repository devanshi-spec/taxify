
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { FlowEditorClient } from '@/components/flows/flow-editor-client'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function FlowPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const dbUser = await prisma.user.findUnique({ where: { supabaseUserId: user.id } })
    if (!dbUser) redirect('/login')

    const flow = await prisma.whatsAppFlow.findUnique({
        where: { id, organizationId: dbUser.organizationId }
    })

    if (!flow) notFound()

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/flows" className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight">{flow.name}</h1>
                            <Badge variant="outline">{flow.version}</Badge>
                            <Badge variant={flow.status === 'PUBLISHED' ? 'default' : 'secondary'}>{flow.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{flow.id}</p>
                    </div>
                </div>
            </div>

            <FlowEditorClient flow={flow} />
        </div>
    )
}
