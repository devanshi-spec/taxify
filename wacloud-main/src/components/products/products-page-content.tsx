'use client'

import { useState, useCallback } from 'react'
import { ProductsList } from '@/components/products/products-list'
import { ProductDialog } from '@/components/products/product-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Plus,
    Search,
    Package,
    ShoppingBag,
    BarChart3,
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export function ProductsPageContent() {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        synced: 0,
    })

    const handleAddProduct = () => {
        setEditingProduct(null)
        setDialogOpen(true)
    }

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product)
        setDialogOpen(true)
    }

    const handleSuccess = useCallback(() => {
        setRefreshKey(prev => prev + 1)
    }, [])

    const handleStatsUpdate = useCallback((newStats: typeof stats) => {
        setStats(newStats)
    }, [])

    return (
        <div className="flex-1 overflow-auto p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingBag className="h-6 w-6" />
                        Product Catalog
                    </h2>
                    <p className="text-muted-foreground">
                        Manage your product catalog for WhatsApp Commerce
                    </p>
                </div>
                <Button onClick={handleAddProduct}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Products</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Synced to WhatsApp</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.synced}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="electronics">Electronics</SelectItem>
                        <SelectItem value="clothing">Clothing</SelectItem>
                        <SelectItem value="food">Food & Beverages</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Products List */}
            <ProductsList
                key={refreshKey}
                searchQuery={searchQuery}
                categoryFilter={categoryFilter === 'all' ? undefined : categoryFilter}
                onEdit={handleEditProduct}
                onStatsUpdate={handleStatsUpdate}
            />

            {/* Product Dialog */}
            <ProductDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                product={editingProduct}
                onSuccess={handleSuccess}
            />
        </div>
    )
}
