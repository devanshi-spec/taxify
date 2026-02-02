'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, FileText, Globe, Trash2, BookOpen, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface KnowledgeDocument {
    id: string
    name: string
    type: 'PDF' | 'DOCX' | 'TXT' | 'URL' | 'CSV'
    status: 'PENDING' | 'INDEXING' | 'INDEXED' | 'FAILED'
    externalUrl?: string
    storageUrl?: string
    fileSize?: number
    createdAt: string
    errorMessage?: string
}

interface Stats {
    total: number
    indexed: number
    pending: number
    failed: number
}

export default function KnowledgeBasePage() {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, indexed: 0, pending: 0, failed: 0 })
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    // Form state
    const [urlInput, setUrlInput] = useState('')

    const fetchDocuments = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/knowledge-base')
            if (response.ok) {
                const data = await response.json()
                setDocuments(data.documents || [])
                setStats(data.stats || { total: 0, indexed: 0, pending: 0, failed: 0 })
            } else {
                toast.error('Failed to load documents')
            }
        } catch (error) {
            console.error('Error fetching documents:', error)
            toast.error('Failed to load documents')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDocuments()
    }, [])

    const handleAddUrl = async () => {
        if (!urlInput.trim()) {
            toast.error('Please enter a URL')
            return
        }

        try {
            setSubmitting(true)
            const response = await fetch('/api/knowledge-base', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: urlInput,
                    type: 'URL',
                    externalUrl: urlInput,
                }),
            })

            if (response.ok) {
                toast.success('URL added successfully')
                setUrlInput('')
                setDialogOpen(false)
                fetchDocuments()
            } else {
                const error = await response.json()
                toast.error(error.error || 'Failed to add URL')
            }
        } catch (error) {
            console.error('Error adding URL:', error)
            toast.error('Failed to add URL')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            setDeleting(id)
            const response = await fetch(`/api/knowledge-base/${id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                toast.success('Document deleted')
                fetchDocuments()
            } else {
                toast.error('Failed to delete document')
            }
        } catch (error) {
            console.error('Error deleting document:', error)
            toast.error('Failed to delete document')
        } finally {
            setDeleting(null)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'INDEXED':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'INDEXING':
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            case 'FAILED':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'INDEXED':
                return 'Indexed'
            case 'INDEXING':
                return 'Syncing...'
            case 'PENDING':
                return 'Pending'
            case 'FAILED':
                return 'Failed'
            default:
                return status
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">AI Knowledge Base</h2>
                    <p className="text-muted-foreground">
                        Manage the documents and links your AI uses to answer customer questions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchDocuments} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Upload className="mr-2 h-4 w-4" />
                                Add Source
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Knowledge Source</DialogTitle>
                                <DialogDescription>
                                    Add a URL or upload a document to train your AI assistant.
                                </DialogDescription>
                            </DialogHeader>
                            <Tabs defaultValue="url" className="mt-4">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="url">URL</TabsTrigger>
                                    <TabsTrigger value="file" disabled>File Upload</TabsTrigger>
                                </TabsList>
                                <TabsContent value="url" className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="url">Website URL</Label>
                                        <Input
                                            id="url"
                                            placeholder="https://example.com/page"
                                            value={urlInput}
                                            onChange={(e) => setUrlInput(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter the URL of a webpage to index its content.
                                        </p>
                                    </div>
                                </TabsContent>
                                <TabsContent value="file" className="space-y-4 mt-4">
                                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                                        <p className="text-muted-foreground">
                                            File upload coming soon
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddUrl} disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Source
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : stats.total}</div>
                        <p className="text-xs text-muted-foreground">data sources added</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Indexed</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{loading ? '...' : stats.indexed}</div>
                        <p className="text-xs text-muted-foreground">ready for AI queries</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Processing</CardTitle>
                        <Loader2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{loading ? '...' : stats.pending}</div>
                        <p className="text-xs text-muted-foreground">being indexed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{loading ? '...' : stats.failed}</div>
                        <p className="text-xs text-muted-foreground">need attention</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Data Sources</CardTitle>
                    <CardDescription>Files and URLs currently indexed for RAG retrieval.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No documents yet</p>
                            <p className="text-sm">Add a URL or upload a file to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-secondary rounded-lg">
                                            {doc.type === 'URL' ? <Globe className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-orange-500" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm truncate max-w-md" title={doc.name}>{doc.name}</p>
                                            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                                                <span className="font-semibold">{doc.type}</span>
                                                <span>•</span>
                                                <span>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</span>
                                            </div>
                                            {doc.errorMessage && (
                                                <p className="text-xs text-red-500 mt-1">{doc.errorMessage}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusBadge(doc.status)}`}>
                                            {getStatusLabel(doc.status)}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="hover:text-destructive"
                                            onClick={() => handleDelete(doc.id)}
                                            disabled={deleting === doc.id}
                                        >
                                            {deleting === doc.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
