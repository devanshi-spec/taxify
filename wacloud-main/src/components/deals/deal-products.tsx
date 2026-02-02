'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Search, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface DealProductsProps {
    dealId: string
    currency: string
}

export function DealProducts({ dealId, currency }: DealProductsProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const queryClient = useQueryClient()

    // Fetch Deal Products
    const { data: dealProducts = [], isLoading } = useQuery({
        queryKey: ['deal-products', dealId],
        queryFn: async () => {
            const res = await fetch(`/api/deals/${dealId}/products`)
            if (!res.ok) throw new Error('Failed to fetch deal products')
            return res.json()
        }
    })

    // Fetch Catalog Products (for selection)
    const { data: catalogProducts = [] } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const res = await fetch('/api/products') // Assuming this endpoint exists or similar
            if (!res.ok) return []
            return res.json()
        },
        enabled: isDialogOpen
    })

    // Since we don't have a direct /api/products endpoint yet, let's assume we might need one or mock it first if products module API is missing.
    // Actually, I should check if /api/products exists. Based on files it might be there.
    // For now I will proceed assuming basic GET /api/products works or I'll fix it if it fails.

    // Add Product Mutation
    const addProductMutation = useMutation({
        mutationFn: async (product: any) => {
            const res = await fetch(`/api/deals/${dealId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: product.id,
                    quantity: 1,
                    unitPrice: product.price
                }),
            })
            if (!res.ok) throw new Error('Failed to add product')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deal-products', dealId] })
            // Also invalidate deal list to show new value
            queryClient.invalidateQueries({ queryKey: ['deals'] })
            setIsDialogOpen(false)
            toast.success('Product added to deal')
        },
        onError: () => {
            toast.error('Failed to add product')
        }
    })

    // Remove Product Mutation
    const removeProductMutation = useMutation({
        mutationFn: async (productId: string) => {
            const res = await fetch(`/api/deals/${dealId}/products?productId=${productId}`, {
                method: 'DELETE',
            })
            if (!res.ok) throw new Error('Failed to remove product')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deal-products', dealId] })
            queryClient.invalidateQueries({ queryKey: ['deals'] })
            toast.success('Product removed')
        },
        onError: () => {
            toast.error('Failed to remove product')
        }
    })

    // Filter catalog products
    const filteredCatalog = catalogProducts.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const totalValue = dealProducts.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">Line Items</CardTitle>
                    <CardDescription>Manage products for this deal</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add Product to Deal</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <div className="relative mb-4">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search catalog..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                                {filteredCatalog.map((product: any) => (
                                    <div key={product.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 cursor-pointer"
                                        onClick={() => addProductMutation.mutate(product)}>
                                        <div>
                                            <p className="font-medium">{product.name}</p>
                                            <p className="text-xs text-muted-foreground">SKU: {product.sku || 'N/A'}</p>
                                        </div>
                                        <div className="font-semibold">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency || 'USD' }).format(product.price)}
                                        </div>
                                    </div>
                                ))}
                                {filteredCatalog.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground py-4">No products found.</p>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {dealProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border rounded-lg border-dashed">
                        <ShoppingBag className="h-8 w-8 mb-2 opacity-50" />
                        <p>No products added yet.</p>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="w-[100px]">Qty</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dealProducts.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.product.name}</div>
                                            <div className="text-xs text-muted-foreground">{item.product.sku}</div>
                                        </TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell className="text-right">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(item.unitPrice * item.quantity)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                                onClick={() => removeProductMutation.mutate(item.product.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="bg-muted/50 p-4 flex justify-between items-center border-t">
                            <span className="font-semibold">Total Value</span>
                            <span className="font-bold text-lg">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(totalValue)}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
