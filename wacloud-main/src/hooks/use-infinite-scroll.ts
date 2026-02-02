'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface UseInfiniteScrollOptions<T> {
    fetchMore: (page: number) => Promise<T[]>
    initialData?: T[]
    pageSize?: number
    threshold?: number
    enabled?: boolean
}

interface UseInfiniteScrollReturn<T> {
    data: T[]
    loading: boolean
    hasMore: boolean
    error: Error | null
    loadMore: () => void
    reset: () => void
}

/**
 * Hook for implementing infinite scroll with automatic loading
 */
export function useInfiniteScroll<T>({
    fetchMore,
    initialData = [],
    pageSize = 20,
    threshold = 100,
    enabled = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
    const [data, setData] = useState<T[]>(initialData)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)
    const loadingRef = useRef(false)

    const loadMore = useCallback(async () => {
        if (!enabled || loading || !hasMore || loadingRef.current) return

        loadingRef.current = true
        setLoading(true)
        setError(null)

        try {
            const newData = await fetchMore(page)

            if (newData.length < pageSize) {
                setHasMore(false)
            }

            setData((prev) => [...prev, ...newData])
            setPage((prev) => prev + 1)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load more'))
            console.error('Error loading more data:', err)
        } finally {
            setLoading(false)
            loadingRef.current = false
        }
    }, [enabled, loading, hasMore, page, pageSize, fetchMore])

    const reset = useCallback(() => {
        setData(initialData)
        setPage(1)
        setHasMore(true)
        setError(null)
        setLoading(false)
        loadingRef.current = false
    }, [initialData])

    return {
        data,
        loading,
        hasMore,
        error,
        loadMore,
        reset,
    }
}

/**
 * Hook for attaching infinite scroll to a scrollable element
 */
export function useInfiniteScrollObserver<T>(
    options: UseInfiniteScrollOptions<T> & { containerRef?: React.RefObject<HTMLElement> }
) {
    const { containerRef, threshold = 100, ...scrollOptions } = options
    const { data, loading, hasMore, loadMore, reset, error } = useInfiniteScroll(scrollOptions)
    const sentinelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!sentinelRef.current || !hasMore || loading) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore()
                }
            },
            {
                root: containerRef?.current || null,
                rootMargin: `${threshold}px`,
                threshold: 0.1,
            }
        )

        observer.observe(sentinelRef.current)

        return () => observer.disconnect()
    }, [hasMore, loading, loadMore, threshold, containerRef])

    return {
        data,
        loading,
        hasMore,
        error,
        loadMore,
        reset,
        sentinelRef,
    }
}

/**
 * Hook for scroll-based pagination (manual trigger)
 */
export function useScrollPagination<T>(
    options: UseInfiniteScrollOptions<T>
) {
    const scrollOptions = useInfiniteScroll(options)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleScroll = useCallback(() => {
        if (!containerRef.current || scrollOptions.loading || !scrollOptions.hasMore) return

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current
        const threshold = options.threshold || 100

        if (scrollHeight - scrollTop - clientHeight < threshold) {
            scrollOptions.loadMore()
        }
    }, [scrollOptions, options.threshold])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    return {
        ...scrollOptions,
        containerRef,
    }
}

/**
 * Hook for reverse infinite scroll (loading older items at top)
 * Useful for chat messages
 */
export function useReverseInfiniteScroll<T>({
    fetchMore,
    initialData = [],
    pageSize = 50,
    enabled = true,
}: Omit<UseInfiniteScrollOptions<T>, 'threshold'>) {
    const [data, setData] = useState<T[]>(initialData)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const previousScrollHeight = useRef(0)

    const loadMore = useCallback(async () => {
        if (!enabled || loading || !hasMore) return

        setLoading(true)
        setError(null)

        // Store current scroll position
        const container = containerRef.current
        if (container) {
            previousScrollHeight.current = container.scrollHeight
        }

        try {
            const newData = await fetchMore(page)

            if (newData.length < pageSize) {
                setHasMore(false)
            }

            // Prepend new data (older messages)
            setData((prev) => [...newData, ...prev])
            setPage((prev) => prev + 1)

            // Restore scroll position after new items are added
            if (container) {
                requestAnimationFrame(() => {
                    const newScrollHeight = container.scrollHeight
                    const scrollDiff = newScrollHeight - previousScrollHeight.current
                    container.scrollTop = scrollDiff
                })
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load more'))
            console.error('Error loading more data:', err)
        } finally {
            setLoading(false)
        }
    }, [enabled, loading, hasMore, page, pageSize, fetchMore])

    const handleScroll = useCallback(() => {
        const container = containerRef.current
        if (!container || loading || !hasMore) return

        // Load more when scrolled near the top
        if (container.scrollTop < 100) {
            loadMore()
        }
    }, [loading, hasMore, loadMore])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    const reset = useCallback(() => {
        setData(initialData)
        setPage(1)
        setHasMore(true)
        setError(null)
        setLoading(false)
    }, [initialData])

    return {
        data,
        loading,
        hasMore,
        error,
        loadMore,
        reset,
        containerRef,
    }
}
