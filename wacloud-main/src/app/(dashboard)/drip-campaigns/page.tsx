
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Plus, MoreVertical } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function DripCampaignsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold">Unauthorized</h1>
            </div>
        )
    }

    const dbUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        select: { organizationId: true }
    })

    if (!dbUser) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold">User configuration error</h1>
            </div>
        )
    }

    const sequences = await prisma.dripSequence.findMany({
        where: { organizationId: dbUser.organizationId },
        orderBy: { updatedAt: 'desc' },
        include: {
            _count: {
                select: { campaigns: true, enrollments: true }
            }
        }
    })

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Drip Campaigns</h1>
                    <p className="text-muted-foreground">Automate your follow-ups with sequences.</p>
                </div>
                <Link href="/drip-campaigns/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Sequence
                    </Button>
                </Link>
            </div>

            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Trigger</TableHead>
                            <TableHead>Stats</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sequences.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No sequences found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sequences.map((seq) => (
                                <TableRow key={seq.id}>
                                    <TableCell className="font-medium">
                                        <Link href={`/drip-campaigns/${seq.id}`} className="hover:underline flex flex-col">
                                            <span className="font-medium">{seq.name}</span>
                                            {seq.description && <span className="text-xs text-muted-foreground">{seq.description}</span>}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">{seq.entryTrigger.replace('_', ' ')}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-4 text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{seq._count.campaigns}</span>
                                                <span className="text-xs text-muted-foreground">Steps</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{seq._count.enrollments}</span>
                                                <span className="text-xs text-muted-foreground">Enrolled</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={seq.isActive ? 'default' : 'secondary'}>
                                            {seq.isActive ? 'Active' : 'Draft'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link href={`/drip-campaigns/${seq.id}`}>
                                                <MoreVertical className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
