'use client'

import { useState, useEffect } from 'react'
import { Search, ShoppingBag, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useDebounce } from '@/hooks/use-debounce'

interface Product {
    id: string
    name: string
    price: number
    currency: string
    imageUrl: string | null
    description: string | null
    sku: string | null
    waProductId: string | null
}

interface ProductPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSend: (products: Product[]) => void
}

export function ProductPicker({ open, onOpenChange, onSend }: ProductPickerProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 300)

    // Fetch products
    useEffect(() => {
        if (open) {
            fetchProducts()
        }
    }, [open, debouncedSearch])

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (debouncedSearch) params.set('search', debouncedSearch)

            const response = await fetch(`/api/products?${params.toString()}`)
            if (response.ok) {
                const data = await response.json()
                setProducts(data.data || [])
            }
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleProduct = (product: Product) => {
        setSelectedProducts(prev => {
            const exists = prev.find(p => p.id === product.id)
            if (exists) {
                return prev.filter(p => p.id !== product.id)
            } else {
                // Limit to 30 products (WhatsApp limit for Multi-Product messages)
                if (prev.length >= 30) return prev
                return [...prev, product]
            }
        })
    }

    const handleSend = () => {
        onSend(selectedProducts)
        setSelectedProducts([])
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Send Products</DialogTitle>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="h-[300px] border rounded-md p-2">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                                <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                                <p>No products found</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleToggleProduct(product)}
                                    >
                                        <Checkbox
                                            checked={selectedProducts.some(p => p.id === product.id)}
                                            onCheckedChange={() => handleToggleProduct(product)}
                                            className="mt-1"
                                        />

                                        {product.imageUrl ? (
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className="h-12 w-12 rounded-md object-cover bg-muted"
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                                                <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-medium text-sm truncate">{product.name}</h4>
                                                <span className="text-sm font-semibold">{product.currency} {product.price}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">{product.sku}</p>
                                            {product.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>{selectedProducts.length} selected</span>
                        {selectedProducts.some(p => !p.waProductId) && (
                            <span className="text-amber-500 text-xs flex items-center gap-1">
                                Warning: Some products are not synced to Meta
                            </span>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSend} disabled={selectedProducts.length === 0}>
                        Send {selectedProducts.length > 1 ? 'Collection' : 'Product'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
