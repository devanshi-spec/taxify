'use client'

import { useEffect, useCallback } from 'react'

type KeyCombo = {
    key: string
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    alt?: boolean
}

type ShortcutMap = {
    [action: string]: KeyCombo
}

interface UseKeyboardShortcutsOptions {
    shortcuts: {
        combo: KeyCombo
        action: () => void
        description?: string
    }[]
    enabled?: boolean
}

/**
 * Check if a keyboard event matches a key combo
 */
function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
    const key = event.key.toLowerCase()
    const comboKey = combo.key.toLowerCase()

    // Check modifiers
    if (combo.ctrl && !event.ctrlKey) return false
    if (combo.meta && !event.metaKey) return false
    if (combo.shift && !event.shiftKey) return false
    if (combo.alt && !event.altKey) return false

    // Check if no modifiers are required but some are pressed
    if (!combo.ctrl && event.ctrlKey) return false
    if (!combo.meta && event.metaKey) return false
    if (!combo.shift && event.shiftKey) return false
    if (!combo.alt && event.altKey) return false

    return key === comboKey
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts({
    shortcuts,
    enabled = true,
}: UseKeyboardShortcutsOptions) {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!enabled) return

            // Ignore if user is typing in an input field
            const target = event.target as HTMLElement
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.contentEditable === 'true'
            ) {
                return
            }

            for (const shortcut of shortcuts) {
                if (matchesCombo(event, shortcut.combo)) {
                    event.preventDefault()
                    shortcut.action()
                    break
                }
            }
        },
        [shortcuts, enabled]
    )

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}

/**
 * Default inbox keyboard shortcuts
 */
export const INBOX_SHORTCUTS = {
    newMessage: { key: 'n', ctrl: true },
    search: { key: 'k', meta: true },
    nextConversation: { key: 'j' },
    prevConversation: { key: 'k' },
    closeConversation: { key: 'Escape' },
    markResolved: { key: 'r', shift: true },
    assignToMe: { key: 'a', shift: true },
    toggleAI: { key: 'i', ctrl: true },
    quickReply: { key: '/' },
} as const satisfies ShortcutMap

/**
 * Format key combo for display
 */
export function formatKeyCombo(combo: KeyCombo): string {
    const parts: string[] = []

    if (combo.ctrl) parts.push('Ctrl')
    if (combo.meta) parts.push('⌘')
    if (combo.shift) parts.push('Shift')
    if (combo.alt) parts.push('Alt')

    parts.push(combo.key.toUpperCase())

    return parts.join(' + ')
}

/**
 * Hook for inbox-specific shortcuts
 */
export function useInboxShortcuts({
    onNewMessage,
    onSearch,
    onNextConversation,
    onPrevConversation,
    onCloseConversation,
    onMarkResolved,
    onAssignToMe,
    onToggleAI,
    onQuickReply,
    enabled = true,
}: {
    onNewMessage?: () => void
    onSearch?: () => void
    onNextConversation?: () => void
    onPrevConversation?: () => void
    onCloseConversation?: () => void
    onMarkResolved?: () => void
    onAssignToMe?: () => void
    onToggleAI?: () => void
    onQuickReply?: () => void
    enabled?: boolean
}) {
    const shortcuts = [
        onNewMessage && { combo: INBOX_SHORTCUTS.newMessage, action: onNewMessage },
        onSearch && { combo: INBOX_SHORTCUTS.search, action: onSearch },
        onNextConversation && { combo: INBOX_SHORTCUTS.nextConversation, action: onNextConversation },
        onPrevConversation && { combo: INBOX_SHORTCUTS.prevConversation, action: onPrevConversation },
        onCloseConversation && { combo: INBOX_SHORTCUTS.closeConversation, action: onCloseConversation },
        onMarkResolved && { combo: INBOX_SHORTCUTS.markResolved, action: onMarkResolved },
        onAssignToMe && { combo: INBOX_SHORTCUTS.assignToMe, action: onAssignToMe },
        onToggleAI && { combo: INBOX_SHORTCUTS.toggleAI, action: onToggleAI },
        onQuickReply && { combo: INBOX_SHORTCUTS.quickReply, action: onQuickReply },
    ].filter(Boolean) as UseKeyboardShortcutsOptions['shortcuts']

    useKeyboardShortcuts({ shortcuts, enabled })
}

/**
 * Keyboard shortcuts help dialog content
 */
export const KEYBOARD_SHORTCUTS_HELP = [
    {
        category: 'Navigation', shortcuts: [
            { combo: INBOX_SHORTCUTS.nextConversation, description: 'Next conversation' },
            { combo: INBOX_SHORTCUTS.prevConversation, description: 'Previous conversation' },
            { combo: INBOX_SHORTCUTS.closeConversation, description: 'Close/deselect conversation' },
        ]
    },
    {
        category: 'Actions', shortcuts: [
            { combo: INBOX_SHORTCUTS.newMessage, description: 'New message' },
            { combo: INBOX_SHORTCUTS.search, description: 'Search' },
            { combo: INBOX_SHORTCUTS.markResolved, description: 'Mark as resolved' },
            { combo: INBOX_SHORTCUTS.assignToMe, description: 'Assign to me' },
            { combo: INBOX_SHORTCUTS.toggleAI, description: 'Toggle AI assistant' },
            { combo: INBOX_SHORTCUTS.quickReply, description: 'Quick reply' },
        ]
    },
]
