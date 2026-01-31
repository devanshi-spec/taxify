
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { DripBuilder } from '@/components/drip/drip-builder'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function DripSequencePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    if (id === 'new') {
        redirect('/drip-campaigns/new')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const dbUser = await prisma.user.findUnique({ where: { supabaseUserId: user.id } })
    if (!dbUser) redirect('/login')

    const sequence = await prisma.dripSequence.findUnique({
        where: { id, organizationId: dbUser.organizationId },
        include: { campaigns: true }
    })

    if (!sequence) notFound()

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4 transition-colors">
                <Link href="/drip-campaigns" className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{sequence.name}</h1>
                    <p className="text-sm text-muted-foreground">{sequence.description || 'Edit your sequence flow below.'}</p>
                </div>
            </div>

            <DripBuilder sequence={sequence} />
        </div>
    )
}
