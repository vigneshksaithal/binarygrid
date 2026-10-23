/**
 * Share state management for Binary Grid puzzle results.
 * Handles clipboard copying and the score comment on Reddit.
 */

import { writable } from 'svelte/store'
import {
    formatShareText,
    SHARE_LOGIN_REQUIRED_ERROR,
    type ScoreShareRequest,
    type ShareMode,
    type ShareTemplateId,
    type ShareTextInput,
} from '../../shared/share-formatter'
import type { Difficulty } from '../../shared/types/puzzle'
import { copyToClipboard } from '../services/clipboard'

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
 * What the result screen knows when the player opens the score preview.
 */
export type ScoreShareDraft = {
    dayNumber: number
    solveTimeSeconds: number
    difficulty: Difficulty
    streak: number
    customText: string
}

// Today's template line under a generic score
const DEFAULT_SHARE_TEMPLATE: ShareTemplateId = 'beat_time'

export const SHARE_FAILED_MESSAGE = "Couldn't post your comment."
export const SHARE_LOGIN_MESSAGE = 'Log in to Reddit to comment your score.'

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
 * Builds the request the preview shows and Post sends.
 */
export const buildScoreShareRequest = (draft: ScoreShareDraft): ScoreShareRequest => ({
    ...draft,
    templateId: DEFAULT_SHARE_TEMPLATE,
})

/**
 * Tells the player where the comment goes and which account posts it.
 */
export const describeShareDestination = (mode: ShareMode, username: string | undefined): string => {
    const account = username ? `as u/${username}` : 'from your account'
    return mode === 'scoreThread'
        ? `Reply in today's score thread ${account}`
        : `Comment on this post ${account}`
}

const readShareError = async (res: Response): Promise<string> => {
    const data: unknown = await res.json().catch(() => null)
    const isLoginRequired =
        typeof data === 'object' && data !== null && 'error' in data && data.error === SHARE_LOGIN_REQUIRED_ERROR
    return isLoginRequired ? SHARE_LOGIN_MESSAGE : SHARE_FAILED_MESSAGE
}

const finishSharing = (shareError: string | null): void => {
    shareState.update((s) => ({
        ...s,
        isSharing: false,
        shareSuccess: shareError === null,
        shareError,
    }))
}

/**
 * Posts the score comment the player previewed. The request goes out unchanged,
 * so the server formats the same text the preview showed.
 *
 * @param request - The previewed score share
 * @returns Promise resolving to success status
 */
export const shareToReddit = async (request: ScoreShareRequest): Promise<boolean> => {
    shareState.update((s) => ({
        ...s,
        isSharing: true,
        shareSuccess: null,
        shareError: null,
    }))

    try {
        const res = await fetch('/api/share-score', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
        })
        const shareError = res.ok ? null : await readShareError(res)
        finishSharing(shareError)
        return shareError === null
    } catch {
        finishSharing(SHARE_FAILED_MESSAGE)
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
