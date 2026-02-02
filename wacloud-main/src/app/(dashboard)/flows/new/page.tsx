
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewFlowPage() {
    async function create(formData: FormData) {
        'use server'
        const name = formData.get('name') as string
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const dbUser = await prisma.user.findUnique({ where: { supabaseUserId: user.id } })
        if (!dbUser) return

        const flow = await prisma.whatsAppFlow.create({
            data: {
                name,
                organizationId: dbUser.organizationId,
                status: 'DRAFT',
                version: '3.0',
                flowJson: {
                    version: "3.0",
                    screens: [
                        {
                            id: "WELCOME_SCREEN",
                            title: "Welcome",
                            data: {},
                            layout: {
                                type: "SingleColumnLayout",
                                children: [
                                    {
                                        type: "TextHeading",
                                        text: "Hello World"
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        })
        redirect(`/flows/${flow.id}`)
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Link href="/flows" className="flex items-center text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Flows
            </Link>
            <Card>
                <CardHeader>
                    <CardTitle>Create New WhatsApp Flow</CardTitle>
                    <CardDescription>Define a Native Flow JSON structure.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={create} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Flow Name</Label>
                            <Input id="name" name="name" placeholder="e.g. Appointment Booking" required autoFocus />
                        </div>
                        <div className="pt-2">
                            <Button type="submit">Create Flow</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
