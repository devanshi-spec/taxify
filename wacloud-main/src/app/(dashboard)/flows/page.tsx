
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Plus, MoreVertical, Layout, Code } from 'lucide-react'
import Link from 'next/link'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

export default async function FlowsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const dbUser = await prisma.user.findUnique({ where: { supabaseUserId: user.id } })
    if (!dbUser) redirect('/login')

    const flows = await prisma.whatsAppFlow.findMany({
        where: { organizationId: dbUser.organizationId },
        orderBy: { updatedAt: 'desc' }
    })

    // Basic enum mapping if needed, or use raw
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PUBLISHED': return 'default'
            case 'DRAFT': return 'secondary'
            case 'DEPRECATED': return 'destructive'
            default: return 'outline'
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">WhatsApp Flows</h1>
                    <p className="text-muted-foreground">Manage Native WhatsApp Flow screens and forms.</p>
                </div>
                <Link href="/flows/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Flow
                    </Button>
                </Link>
            </div>

            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Meta ID</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {flows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Layout className="h-8 w-8 text-muted-foreground/50" />
                                        <p>No flows found.</p>
                                        <p className="text-xs">Create a native form to collect data from users.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            flows.map((flow) => (
                                <TableRow key={flow.id}>
                                    <TableCell className="font-medium">
                                        <Link href={`/flows/${flow.id}`} className="hover:underline flex flex-col">
                                            <span className="font-medium flex items-center gap-2">{flow.name}</span>
                                            {flow.description && <span className="text-xs text-muted-foreground">{flow.description}</span>}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-xs">{flow.waFlowId || '-'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{flow.version}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusColor(flow.status)}>{flow.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link href={`/flows/${flow.id}`}>
                                                <Code className="h-4 w-4" />
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
