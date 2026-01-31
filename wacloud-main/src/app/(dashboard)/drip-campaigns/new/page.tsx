
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewSequencePage() {
    async function create(formData: FormData) {
        'use server'
        const name = formData.get('name') as string
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const dbUser = await prisma.user.findUnique({ where: { supabaseUserId: user.id } })
        if (!dbUser) return

        // Need a default channel. 
        const channel = await prisma.channel.findFirst({
            where: { organizationId: dbUser.organizationId, status: 'CONNECTED' }
        })

        // If no connected channel, try any channel
        const finalChannel = channel || await prisma.channel.findFirst({ where: { organizationId: dbUser.organizationId } })

        if (!finalChannel) {
            // In a real app we'd show a specialized error page or redirect to channels
            throw new Error("You need to connect a WhatsApp channel first.")
        }

        const seq = await prisma.dripSequence.create({
            data: {
                name,
                organizationId: dbUser.organizationId,
                channelId: finalChannel.id,
                entryTrigger: 'tag_added', // Default trigger
            }
        })
        redirect(`/drip-campaigns/${seq.id}`)
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Link href="/drip-campaigns" className="flex items-center text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sequences
            </Link>
            <Card>
                <CardHeader>
                    <CardTitle>Create New Sequence</CardTitle>
                    <CardDescription>Start a new automated drip campaign.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={create} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Sequence Name</Label>
                            <Input id="name" name="name" placeholder="e.g. New Lead Welcome Series" required autoFocus />
                        </div>
                        <div className="pt-2">
                            <Button type="submit">Create & Start Building</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
