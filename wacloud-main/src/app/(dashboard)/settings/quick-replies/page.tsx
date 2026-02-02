'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, MoreVertical, Pencil, Trash, MessageSquareText, Globe, User } from 'lucide-react'
import { toast } from 'sonner'
import { QuickReplyDialog } from '@/components/quick-replies/quick-reply-dialog'

interface QuickReply {
  id: string
  title: string
  shortcut: string
  content: string
  category: string | null
  tags: string[]
  usageCount: number
  isGlobal: boolean
  createdAt: string
}

export default function QuickRepliesPage() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingReply, setDeletingReply] = useState<QuickReply | null>(null)

  const fetchQuickReplies = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter)

      const response = await fetch(`/api/quick-replies?${params}`)
      if (response.ok) {
        const result = await response.json()
        setQuickReplies(result.data || [])
        setCategories(result.categories || [])
      }
    } catch (error) {
      console.error('Error fetching quick replies:', error)
      toast.error('Failed to load quick replies')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    fetchQuickReplies()
  }, [fetchQuickReplies])

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingReply) return

    try {
      const response = await fetch(`/api/quick-replies/${deletingReply.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Quick reply deleted')
        fetchQuickReplies()
      } else {
        throw new Error('Failed to delete')
      }
    } catch (error) {
      toast.error('Failed to delete quick reply')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingReply(null)
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingReply(null)
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quick Replies</h2>
          <p className="text-muted-foreground">
            Create templates for fast responses. Type "/" in chat to use them.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Quick Reply
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, shortcut, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Shortcut</TableHead>
              <TableHead className="max-w-[300px]">Content</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead className="text-center">Uses</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : quickReplies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MessageSquareText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No quick replies yet</p>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                      Create your first quick reply
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              quickReplies.map((reply) => (
                <TableRow key={reply.id}>
                  <TableCell className="font-medium">{reply.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{reply.shortcut}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {reply.content}
                    </p>
                  </TableCell>
                  <TableCell>
                    {reply.category ? (
                      <Badge variant="outline">{reply.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {reply.isGlobal ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Globe className="h-3 w-3" />
                        Team
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        Personal
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{reply.usageCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(reply)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setDeletingReply(reply)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <QuickReplyDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        quickReply={editingReply}
        onSuccess={fetchQuickReplies}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quick Reply</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingReply?.title}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
