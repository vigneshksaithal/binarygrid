/**
 * Share text formatter for Binary Grid puzzle results.
 * Generates spoiler-free shareable text with emoji grid representation.
 */

import type { Difficulty, Grid } from './types/puzzle'

/**
 * Input for generating share text.
 */
export interface ShareTextInput {
    grid: Grid
    dayNumber: number
    completionTime: number
    difficulty: Difficulty
}

/**
 * Output from share text generation.
 */
export interface ShareTextOutput {
    text: string      // Full formatted share text
    gridText: string  // Just the grid portion
}

/**
 * Unicode characters for grid representation.
 * 0 → white square, 1 → green square
 */
const CELL_EMOJI = {
    0: '⬜',
    1: '🟩',
} as const

/**
 * Difficulty display labels with proper capitalization.
 */
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
}

/**
 * Formats a grid as emoji text representation.
 * Each cell is mapped: 0 → ⬜, 1 → 🟩
 * Rows are separated by newlines.
 *
 * @param grid - 6x6 grid of 0s and 1s (completed puzzle)
 * @returns String with emoji representation of the grid
 */
export const formatGridAsText = (grid: Grid): string => {
    return grid
        .map((row) =>
            row
                .map((cell) => {
                    if (cell === 0) return CELL_EMOJI[0]
                    if (cell === 1) return CELL_EMOJI[1]
                    // Fallback for null cells (shouldn't happen in completed puzzles)
                    return '⬛'
                })
                .join('')
        )
        .join('\n')
}

/**
 * Formats seconds into MM:SS format.
 *
 * @param seconds - Non-negative integer representing completion time
 * @returns Formatted time string in MM:SS format
 */
export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const paddedMins = String(mins).padStart(2, '0')
    const paddedSecs = String(secs).padStart(2, '0')
    return `${paddedMins}:${paddedSecs}`
}

/**
 * Generates the full share text for a completed puzzle.
 *
 * Output format:
 * ```
 * Binary Grid #47 🧩
 * ⏱️ 02:34 | 🎯 Medium
 *
 * ⬜🟩⬜🟩🟩⬜
 * 🟩⬜🟩⬜⬜🟩
 * ⬜🟩🟩⬜🟩⬜
 * 🟩⬜⬜🟩⬜🟩
 * ⬜🟩⬜🟩🟩⬜
 * 🟩⬜🟩⬜⬜🟩
 *
 * Play at r/binarygrid
 * ```
 *
 * @param input - Share text input containing grid, day number, time, and difficulty
 * @returns ShareTextOutput with full text and grid-only text
 */
export const formatShareText = (input: ShareTextInput): ShareTextOutput => {
    const { grid, dayNumber, completionTime, difficulty } = input

    const header = `Binary Grid #${dayNumber} 🧩`
    const timeLine = `⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    const gridText = formatGridAsText(grid)
    const footer = 'Play at r/binarygrid'

    const text = [header, timeLine, '', gridText, '', footer].join('\n')

    return {
        text,
        gridText,
    }
}

/**
 * Input for generating simple share comment text.
 */
export interface SimpleShareInput {
    dayNumber: number
    completionTime: number
    difficulty: Difficulty
    streak?: number | undefined
}

/**
 * Generates a simple, short share comment for Reddit.
 *
 * Output format:
 * ```
 * Binary Grid #47 🧩 ⏱️ 02:34 | 🎯 Medium 🔥 5 day streak
 * ```
 *
 * @param input - Share input containing day number, time, and difficulty
 * @returns Simple one-line share text
 */
export const formatSimpleShareText = (input: SimpleShareInput): string => {
    const { dayNumber, completionTime, difficulty } = input
    let text = `Binary Grid #${dayNumber} 🧩 ⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    
    if (input.streak !== undefined && input.streak >= 2) {
        text += ` 🔥 ${input.streak} day streak`
    }
    
    return text
}
