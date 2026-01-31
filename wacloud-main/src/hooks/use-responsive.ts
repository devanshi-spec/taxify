'use client'

import { useState, useEffect } from 'react'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
}

/**
 * Hook to detect current screen size
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const media = window.matchMedia(query)

        if (media.matches !== matches) {
            setMatches(media.matches)
        }

        const listener = () => setMatches(media.matches)
        media.addEventListener('change', listener)

        return () => media.removeEventListener('change', listener)
    }, [matches, query])

    return matches
}

/**
 * Hook to check if screen is mobile
 */
export function useIsMobile(): boolean {
    return useMediaQuery(`(max-width: ${breakpoints.md - 1}px)`)
}

/**
 * Hook to check if screen is tablet
 */
export function useIsTablet(): boolean {
    return useMediaQuery(
        `(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`
    )
}

/**
 * Hook to check if screen is desktop
 */
export function useIsDesktop(): boolean {
    return useMediaQuery(`(min-width: ${breakpoints.lg}px)`)
}

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint(): Breakpoint | null {
    const [breakpoint, setBreakpoint] = useState<Breakpoint | null>(null)

    useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth

            if (width >= breakpoints['2xl']) setBreakpoint('2xl')
            else if (width >= breakpoints.xl) setBreakpoint('xl')
            else if (width >= breakpoints.lg) setBreakpoint('lg')
            else if (width >= breakpoints.md) setBreakpoint('md')
            else setBreakpoint('sm')
        }

        updateBreakpoint()
        window.addEventListener('resize', updateBreakpoint)

        return () => window.removeEventListener('resize', updateBreakpoint)
    }, [])

    return breakpoint
}

/**
 * Hook for responsive values
 */
export function useResponsiveValue<T>(values: {
    base: T
    sm?: T
    md?: T
    lg?: T
    xl?: T
    '2xl'?: T
}): T {
    const breakpoint = useBreakpoint()

    if (!breakpoint) return values.base

    if (breakpoint === '2xl' && values['2xl']) return values['2xl']
    if ((breakpoint === '2xl' || breakpoint === 'xl') && values.xl) return values.xl
    if ((breakpoint === 'xl' || breakpoint === 'lg') && values.lg) return values.lg
    if ((breakpoint === 'lg' || breakpoint === 'md') && values.md) return values.md
    if (values.sm) return values.sm

    return values.base
}

/**
 * Hook to detect touch device
 */
export function useIsTouchDevice(): boolean {
    const [isTouch, setIsTouch] = useState(false)

    useEffect(() => {
        setIsTouch(
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            // @ts-ignore - legacy property
            navigator.msMaxTouchPoints > 0
        )
    }, [])

    return isTouch
}

/**
 * Hook to detect device orientation
 */
export function useOrientation(): 'portrait' | 'landscape' {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

    useEffect(() => {
        const updateOrientation = () => {
            setOrientation(
                window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
            )
        }

        updateOrientation()
        window.addEventListener('resize', updateOrientation)
        window.addEventListener('orientationchange', updateOrientation)

        return () => {
            window.removeEventListener('resize', updateOrientation)
            window.removeEventListener('orientationchange', updateOrientation)
        }
    }, [])

    return orientation
}

/**
 * Hook for viewport dimensions
 */
export function useViewport() {
    const [viewport, setViewport] = useState({
        width: 0,
        height: 0,
    })

    useEffect(() => {
        const updateViewport = () => {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        updateViewport()
        window.addEventListener('resize', updateViewport)

        return () => window.removeEventListener('resize', updateViewport)
    }, [])

    return viewport
}

/**
 * Utility function to get responsive class names
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ')
}

/**
 * Responsive container classes
 */
export const containerClasses = {
    base: 'w-full mx-auto px-4 sm:px-6 lg:px-8',
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
}

/**
 * Responsive grid classes
 */
export const gridClasses = {
    cols1: 'grid-cols-1',
    cols2: 'grid-cols-1 sm:grid-cols-2',
    cols3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    cols4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    cols6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}

/**
 * Responsive spacing classes
 */
export const spacingClasses = {
    xs: 'gap-2 sm:gap-3',
    sm: 'gap-3 sm:gap-4',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-12',
}

/**
 * Responsive text size classes
 */
export const textSizeClasses = {
    xs: 'text-xs sm:text-sm',
    sm: 'text-sm sm:text-base',
    base: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl',
    '2xl': 'text-2xl sm:text-3xl',
    '3xl': 'text-3xl sm:text-4xl',
}
