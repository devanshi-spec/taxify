import { format } from 'date-fns'
import { DollarSign, Calendar, ArrowUpRight, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Deal } from '@/types'

interface DealCardProps {
    deal: Deal
    onEdit?: (deal: Deal) => void
    onDelete?: (dealId: string) => void
}

const stageColors: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    QUALIFIED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    PROPOSAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    NEGOTIATION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    WON: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    LOST: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export function DealCard({ deal, onEdit, onDelete }: DealCardProps) {
    return (
        <Card className="mb-3 overflow-hidden border transition-all hover:border-primary/50">
            <CardContent className="p-3">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                        <h4 className="truncate font-semibold text-sm">{deal.title}</h4>
                        <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border-0 ${stageColors[deal.stage] || 'bg-gray-100 text-gray-800'}`}>
                                {deal.stage}
                            </Badge>
                            {deal.assignedTo && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    • {deal.assignedTo}
                                </span>
                            )}
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1">
                                <MoreVertical className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit?.(deal)}>
                                <Edit className="mr-2 h-3 w-3" />
                                Edit Deal
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(deal.id)}>
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                        <DollarSign className="h-3 w-3" />
                        {deal.value.toLocaleString()}
                    </div>

                    {deal.expectedCloseDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(deal.expectedCloseDate), 'MMM d')}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
