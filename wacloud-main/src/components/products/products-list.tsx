'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
    MoreVertical,
    Edit,
    Trash2,
    Package,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface Product {
    id: string
    name: string
    description: string | null
    sku: string | null
    price: number
    currency: string
    imageUrl: string | null
    category: string | null
    tags: string[]
    quantity: number
    isActive: boolean
    waProductId: string | null
    syncStatus: string
}

interface ProductsListProps {
    searchQuery?: string
    categoryFilter?: string
    onEdit?: (product: Product) => void
    onStatsUpdate?: (stats: { total: number; active: number; synced: number }) => void
}

export function ProductsList({ searchQuery, categoryFilter, onEdit, onStatsUpdate }: ProductsListProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        fetchProducts()
    }, [searchQuery, categoryFilter])

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (searchQuery) params.set('search', searchQuery)
            if (categoryFilter) params.set('category', categoryFilter)

            const response = await fetch(`/api/products?${params}`)
            if (response.ok) {
                const result = await response.json()
                setProducts(result.data || [])

                // Calculate stats
                const total = result.data?.length || 0
                const active = result.data?.filter((p: Product) => p.isActive).length || 0
                const synced = result.data?.filter((p: Product) => p.syncStatus === 'synced').length || 0
                onStatsUpdate?.({ total, active, synced })
            }
        } catch (error) {
            console.error('Error fetching products:', error)
            toast.error('Failed to load products')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return

        try {
            setDeleting(true)
            const response = await fetch(`/api/products/${deleteId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error('Failed to delete product')
            }

            toast.success('Product deleted')
            setDeleteId(null)
            fetchProducts()
        } catch (error) {
            console.error('Error deleting product:', error)
            toast.error('Failed to delete product')
        } finally {
            setDeleting(false)
        }
    }

    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(price)
    }

    const getSyncStatusBadge = (status: string) => {
        switch (status) {
            case 'synced':
                return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Synced</Badge>
            case 'pending':
                return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
            case 'failed':
                return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>
            default:
                return null
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No products yet</h3>
                <p className="text-sm text-muted-foreground">
                    Add your first product to start building your catalog
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                    <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                        {/* Product Image */}
                        <div className="relative aspect-square bg-muted">
                            {product.imageUrl ? (
                                <Image
                                    src={product.imageUrl}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Package className="h-16 w-16 text-muted-foreground/50" />
                                </div>
                            )}
                            {/* Status badges */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                                {!product.isActive && (
                                    <Badge variant="secondary">Inactive</Badge>
                                )}
                                {product.quantity === 0 && (
                                    <Badge variant="destructive">Out of Stock</Badge>
                                )}
                            </div>
                            {/* Actions */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="secondary" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit?.(product)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Share2 className="mr-2 h-4 w-4" />
                                            Share in Chat
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => setDeleteId(product.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Product Info */}
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                                    {getSyncStatusBadge(product.syncStatus)}
                                </div>

                                {product.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {product.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-lg font-bold">
                                        {formatPrice(product.price, product.currency)}
                                    </span>
                                    {product.quantity > 0 && (
                                        <span className="text-sm text-muted-foreground">
                                            {product.quantity} in stock
                                        </span>
                                    )}
                                </div>

                                {product.sku && (
                                    <p className="text-xs text-muted-foreground">
                                        SKU: {product.sku}
                                    </p>
                                )}

                                {product.category && (
                                    <Badge variant="outline" className="text-xs">
                                        {product.category}
                                    </Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Product</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this product? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
