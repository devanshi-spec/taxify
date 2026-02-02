'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

function AcceptInviteContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')

    const [loading, setLoading] = useState(true)
    const [accepting, setAccepting] = useState(false)
    const [invitation, setInvitation] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        // Check auth status
        const checkAuth = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        checkAuth()

        // Verify token
        if (!token) {
            setError('Missing invitation token')
            setLoading(false)
            return
        }

        const verifyToken = async () => {
            try {
                const res = await fetch(`/api/invitations/verify?token=${token}`)
                const data = await res.json()

                if (!res.ok) {
                    setError(data.error || 'Invalid invitation')
                } else {
                    setInvitation(data.data)
                }
            } catch (err) {
                setError('Failed to load invitation')
            } finally {
                setLoading(false)
            }
        }

        verifyToken()
    }, [token])

    const handleAccept = async () => {
        setAccepting(true)
        try {
            const res = await fetch('/api/invitations/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error(data.error)
                return
            }

            toast.success(`Joined ${invitation.organizationName} successfully!`)
            router.push('/dashboard')
        } catch (err) {
            toast.error('Something went wrong')
        } finally {
            setAccepting(false)
        }
    }

    const handleAuthRedirect = (mode: 'login' | 'register') => {
        const returnUrl = encodeURIComponent(`/accept-invite?token=${token}`)
        router.push(`/${mode}?redirectTo=${returnUrl}`)
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center p-4">
                <Card className="w-full max-w-md border-destructive/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            Invitation Error
                        </CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
                            Go Home
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex h-screen items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Join {invitation.organizationName}</CardTitle>
                    <CardDescription>
                        You have been invited by <strong>{invitation.inviterName}</strong> to join their team on WhatsApp CRM.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted p-4 text-center text-sm">
                        <p className="text-muted-foreground">You will join as:</p>
                        <p className="font-semibold uppercase tracking-wide">{invitation.role}</p>
                    </div>

                    {!user && (
                        <div className="text-center text-sm text-yellow-600">
                            Please log in or create an account to accept this invitation.
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    {user ? (
                        <Button className="w-full" size="lg" onClick={handleAccept} disabled={accepting}>
                            {accepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Accept Invitation
                        </Button>
                    ) : (
                        <>
                            <Button className="w-full" onClick={() => handleAuthRedirect('register')}>
                                Create Account & Join
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => handleAuthRedirect('login')}>
                                Log In to Existing Account
                            </Button>
                        </>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AcceptInviteContent />
        </Suspense>
    )
}
