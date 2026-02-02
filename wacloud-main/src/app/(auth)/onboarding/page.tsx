'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, ChevronRight, Loader2, MessageSquare, Users, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [orgName, setOrgName] = useState('')
    const [inviteEmails, setInviteEmails] = useState('')

    // Organization details from DB
    const [orgDetails, setOrgDetails] = useState<{ id: string, name: string, slug: string } | null>(null)

    useEffect(() => {
        // Fetch current user and org
        const fetchOrg = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Fetch org details from our API
            // For now, we'll assume the user is already attached to an org from registration
            // In a real implementation, we'd fetch from /api/organization
            // Here we simulate fetching
            // const res = await fetch('/api/organization') ...
        }
        fetchOrg()
    }, [router])

    const handleNext = () => {
        setStep((current) => Math.min(current + 1, 3))
    }

    const handleFinish = () => {
        setLoading(true)
        // Simulate API calls
        setTimeout(() => {
            toast.success("Setup complete! Welcome to your dashboard.")
            router.push('/dashboard')
        }, 1500)
    }

    return (
        <div className="container flex h-screen w-screen flex-col items-center justify-center">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
                <div className="flex flex-col space-y-2 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Welcome to WhatsApp CRM
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Let's get your account set up in 3 easy steps.
                    </p>
                </div>

                {/* Steps Progress */}
                <div className="flex justify-between px-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors",
                                step >= i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                {step > i ? <Check className="h-4 w-4" /> : i}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {i === 1 ? 'Organization' : i === 2 ? 'Connect' : 'Invite'}
                            </span>
                        </div>
                    ))}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {step === 1 && "Organization Setup"}
                            {step === 2 && "Connect WhatsApp"}
                            {step === 3 && "Invite Team"}
                        </CardTitle>
                        <CardDescription>
                            {step === 1 && "Confirm your workspace details."}
                            {step === 2 && "Scan the QR code to connect your number."}
                            {step === 3 && "Add your team members to collaborate."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* Step 1: Org */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="orgName">Organization Name</Label>
                                    <Input
                                        id="orgName"
                                        placeholder="Acme Corp"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                    // defaultValue={orgDetails?.name} 
                                    />
                                </div>
                                <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                                    Your workspace URL will be: <strong>app.botwa.com/{orgName.toLowerCase().replace(/\s+/g, '-')}</strong>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Connect */}
                        {step === 2 && (
                            <div className="flex flex-col items-center justify-center space-y-4 py-4">
                                <div className="flex h-40 w-40 items-center justify-center rounded-lg border-2 border-dashed bg-muted">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                                <p className="text-center text-sm text-muted-foreground">
                                    Generating QR Code... <br />
                                    (Integration placeholder)
                                </p>
                                <Button variant="outline" className="w-full">
                                    Use API Key Instead
                                </Button>
                            </div>
                        )}

                        {/* Step 3: Invite */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="emails">Email Addresses</Label>
                                    <Input
                                        id="emails"
                                        placeholder="colleague@example.com, partner@example.com"
                                        value={inviteEmails}
                                        onChange={(e) => setInviteEmails(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Separate multiple emails with commas.
                                    </p>
                                </div>
                            </div>
                        )}

                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setStep(Math.max(1, step - 1))}
                            disabled={step === 1 || loading}
                        >
                            Back
                        </Button>

                        {step < 3 ? (
                            <Button onClick={handleNext}>
                                Next <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleFinish} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Finish Setup
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
