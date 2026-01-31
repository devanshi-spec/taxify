'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

interface ErrorBoundaryProps {
    children: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to console (in production, send to error tracking service)
        console.error('Error caught by boundary:', error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    handleGoHome = () => {
        window.location.href = '/inbox'
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
                    <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                            </div>

                            <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
                            <p className="mb-6 text-muted-foreground">
                                We apologize for the inconvenience. An unexpected error has occurred.
                            </p>

                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="mb-6 w-full rounded-lg bg-destructive/5 p-4 text-left">
                                    <p className="mb-1 text-sm font-medium text-destructive">Error Details:</p>
                                    <code className="text-xs text-muted-foreground break-all">
                                        {this.state.error.message}
                                    </code>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button variant="outline" onClick={this.handleReset}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Try Again
                                </Button>
                                <Button onClick={this.handleGoHome}>
                                    <Home className="mr-2 h-4 w-4" />
                                    Go Home
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
