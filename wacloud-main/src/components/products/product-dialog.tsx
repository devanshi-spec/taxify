'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

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
}

interface ProductDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: Product | null
    onSuccess?: () => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sku: '',
        price: '',
        currency: 'INR',
        imageUrl: '',
        category: '',
        tags: '',
        quantity: '0',
        isActive: true,
    })

    useEffect(() => {
        if (open && product) {
            setFormData({
                name: product.name,
                description: product.description || '',
                sku: product.sku || '',
                price: product.price.toString(),
                currency: product.currency,
                imageUrl: product.imageUrl || '',
                category: product.category || '',
                tags: product.tags.join(', '),
                quantity: product.quantity.toString(),
                isActive: product.isActive,
            })
        } else if (open && !product) {
            setFormData({
                name: '',
                description: '',
                sku: '',
                price: '',
                currency: 'INR',
                imageUrl: '',
                category: '',
                tags: '',
                quantity: '0',
                isActive: true,
            })
        }
    }, [open, product])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.price) {
            toast.error('Name and price are required')
            return
        }

        const price = parseFloat(formData.price)
        if (isNaN(price) || price < 0) {
            toast.error('Please enter a valid price')
            return
        }

        const quantity = parseInt(formData.quantity)
        if (isNaN(quantity) || quantity < 0) {
            toast.error('Please enter a valid quantity')
            return
        }

        try {
            setLoading(true)

            const payload = {
                name: formData.name,
                description: formData.description || null,
                sku: formData.sku || null,
                price,
                currency: formData.currency,
                imageUrl: formData.imageUrl || null,
                category: formData.category || null,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                quantity,
                isActive: formData.isActive,
            }

            const url = product ? `/api/products/${product.id}` : '/api/products'
            const method = product ? 'PUT' : 'POST'

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || `Failed to ${product ? 'update' : 'create'} product`)
            }

            toast.success(product ? 'Product updated successfully' : 'Product created successfully')
            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error('Error saving product:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to save product')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
                    <DialogDescription>
                        {product ? 'Update product details' : 'Add a new product to your catalog'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Product Image */}
                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">Product Image URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="imageUrl"
                                    placeholder="https://example.com/image.jpg"
                                    value={formData.imageUrl}
                                    onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                                />
                                <Button type="button" variant="outline" size="icon">
                                    <Upload className="h-4 w-4" />
                                </Button>
                            </div>
                            {formData.imageUrl && (
                                <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6"
                                        onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Name & SKU */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Product Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="iPhone 15 Pro"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input
                                    id="sku"
                                    placeholder="IP15P-256-BLK"
                                    value={formData.sku}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Product description..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                            />
                        </div>

                        {/* Price & Currency */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="price">Price *</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="99999"
                                    value={formData.price}
                                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select
                                    value={formData.currency}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Category & Quantity */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="electronics">Electronics</SelectItem>
                                        <SelectItem value="clothing">Clothing</SelectItem>
                                        <SelectItem value="food">Food & Beverages</SelectItem>
                                        <SelectItem value="services">Services</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min="0"
                                    placeholder="100"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <Label htmlFor="tags">Tags</Label>
                            <Input
                                id="tags"
                                placeholder="premium, bestseller, new (comma-separated)"
                                value={formData.tags}
                                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                            />
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="isActive">Active Status</Label>
                                <p className="text-sm text-muted-foreground">
                                    Make this product visible in your catalog
                                </p>
                            </div>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {product ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                product ? 'Update Product' : 'Create Product'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
