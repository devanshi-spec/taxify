'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { Toaster } from 'sonner'

interface AppProvidersProps {
    children: React.ReactNode
}

// Create a client
const queryClient = new QueryClient()

/**
 * Client-side providers wrapper that includes:
 * - Error Boundary for catching React errors
 * - Toast notifications (Sonner)
 * - Query client
 */
export function AppProviders({ children }: AppProvidersProps) {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster
                    position="top-right"
                    richColors
                    closeButton
                />
            </QueryClientProvider>
        </ErrorBoundary>
    )
}
