'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'

function SuccessContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session_id')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!sessionId) {
            setError('Invalid session')
            setLoading(false)
            return
        }

        // Verify the session (optional - Stripe webhook handles the actual processing)
        setTimeout(() => {
            setLoading(false)
        }, 2000)
    }, [sessionId])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Something went wrong</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Link href="/pricing">
                            <Button>Back to Pricing</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl">Subscription Successful!</CardTitle>
                    <CardDescription>
                        Your subscription has been activated. Welcome aboard! 🎉
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted p-4">
                        <h3 className="font-semibold mb-2">What's next?</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>✓ Your 14-day free trial has started</li>
                            <li>✓ Full access to all features unlocked</li>
                            <li>✓ You won't be charged until the trial ends</li>
                            <li>✓ Cancel anytime from billing settings</li>
                        </ul>
                    </div>

                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <p className="text-sm">
                            <strong>Pro tip:</strong> Connect your WhatsApp channel now to start engaging with customers immediately!
                        </p>
                    </div>
                </CardContent>

                <CardFooter className="flex gap-2">
                    <Link href="/settings/channels" className="flex-1">
                        <Button variant="outline" className="w-full">
                            Connect Channel
                        </Button>
                    </Link>
                    <Link href="/inbox" className="flex-1">
                        <Button className="w-full">
                            Go to Dashboard
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}

export default function BillingSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <SuccessContent />
        </Suspense>
    )
}
