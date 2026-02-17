/**
 * Share state management for Binary Grid puzzle results.
 * Handles clipboard copying and Reddit sharing functionality.
 */

import { writable, get } from 'svelte/store'
import { copyToClipboard } from '../services/clipboard'
import { formatShareText, type ShareTextInput } from '../../shared/share-formatter'
import { streakStore } from './streak'

/**
 * Share state interface for tracking copy and share operations.
 */
export interface ShareState {
    isCopying: boolean
    copySuccess: boolean | null
    isSharing: boolean
    shareSuccess: boolean | null
    shareError: string | null
}

/**
 * Request payload for sharing results as a Reddit comment.
 */
export interface ShareCommentRequest {
    solveTimeSeconds: number
    difficulty: string
    dayNumber: number
    streak?: number
}

const initialState: ShareState = {
    isCopying: false,
    copySuccess: null,
    isSharing: false,
    shareSuccess: null,
    shareError: null,
}

/**
 * Writable store for share state.
 */
export const shareState = writable<ShareState>(initialState)

/**
 * Copies puzzle results to clipboard using ClipboardService and ShareTextFormatter.
 *
 * @param input - Share text input containing grid, day number, time, and difficulty
 * @returns Promise resolving to success status
 */
export const copyResults = async (input: ShareTextInput): Promise<boolean> => {
    // Set copying state
    shareState.update((s) => ({
        ...s,
        isCopying: true,
        copySuccess: null,
    }))

    // Format the share text
    const { text } = formatShareText(input)

    // Copy to clipboard
    const result = await copyToClipboard(text)

    // Update state with result
    shareState.update((s) => ({
        ...s,
        isCopying: false,
        copySuccess: result.success,
    }))

    return result.success
}

/**
 * Shares puzzle results as a Reddit comment.
 * Placeholder implementation - API call will be implemented in Task 8.
 *
 * @param request - Share comment request with solve time, difficulty, and day number
 * @returns Promise resolving to success status
 */
export const shareToReddit = async (request: ShareCommentRequest): Promise<boolean> => {
    // Set sharing state
    shareState.update((s) => ({
        ...s,
        isSharing: true,
        shareSuccess: null,
        shareError: null,
    }))

    try {
        // Get current streak from store
        const streakData = get(streakStore)
        const streak = streakData.data.currentStreak

        // Include streak in request if >= 2
        const requestBody = streak >= 2 
            ? { ...request, streak }
            : request

        const res = await fetch('/api/share-comment', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(requestBody),
        })

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            const errorMessage = data.error || `Failed to share: HTTP ${res.status}`
            shareState.update((s) => ({
                ...s,
                isSharing: false,
                shareSuccess: false,
                shareError: errorMessage,
            }))
            return false
        }

        // Success
        shareState.update((s) => ({
            ...s,
            isSharing: false,
            shareSuccess: true,
            shareError: null,
        }))
        return true
    } catch (err) {
        // Network or unexpected error
        const errorMessage = err instanceof Error
            ? err.message
            : 'An unexpected error occurred while sharing'

        shareState.update((s) => ({
            ...s,
            isSharing: false,
            shareSuccess: false,
            shareError: errorMessage,
        }))
        return false
    }
}

/**
 * Resets copy-related state to initial values.
 * Use after dismissing copy feedback or before a new copy operation.
 */
export const resetCopyState = () => {
    shareState.update((s) => ({
        ...s,
        isCopying: false,
        copySuccess: null,
    }))
}

/**
 * Resets share-related state to initial values.
 * Use after dismissing share feedback or before a new share operation.
 */
export const resetShareState = () => {
    shareState.update((s) => ({
        ...s,
        isSharing: false,
        shareSuccess: null,
        shareError: null,
    }))
}

/**
 * Resets all share state to initial values.
 * Use when closing the share modal or starting fresh.
 */
export const resetAllShareState = () => {
    shareState.set(initialState)
}
