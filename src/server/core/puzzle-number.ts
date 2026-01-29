import { redis } from '@devvit/web/server'

/**
 * Redis key patterns for puzzle numbering:
 * - puzzle:number:counter — Global counter for puzzle numbers
 * - puzzle:number:{postId} — Maps postId to its puzzle number
 * - puzzle:number:date:{dateISO} — Maps date to puzzle number (for daily puzzles)
 */

const PUZZLE_NUMBER_COUNTER_KEY = 'puzzle:number:counter'

const puzzleNumberKey = (postId: string): string =>
    `puzzle:number:${postId}`

const puzzleDateKey = (dateISO: string): string =>
    `puzzle:number:date:${dateISO}`

/**
 * Retrieves the puzzle number for a given post.
 * Returns the puzzle number if it exists, or 0 if not found.
 */
export const getPuzzleNumber = async (postId: string): Promise<number> => {
    const key = puzzleNumberKey(postId)
    const value = await redis.get(key)

    if (!value) {
        return 0
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Gets an existing puzzle number or creates a new one for the given post.
 * Uses the dateISO to track daily puzzles and ensure consistent numbering.
 * 
 * @param postId - The Reddit post ID
 * @param dateISO - The date in ISO format (YYYY-MM-DD)
 * @returns The puzzle number (existing or newly assigned)
 */
export const getOrCreatePuzzleNumber = async (
    postId: string,
    dateISO: string
): Promise<number> => {
    // First, check if this post already has a puzzle number
    const existingNumber = await getPuzzleNumber(postId)
    if (existingNumber > 0) {
        return existingNumber
    }

    // Check if this date already has a puzzle number assigned
    const dateKey = puzzleDateKey(dateISO)
    const existingDateNumber = await redis.get(dateKey)

    if (existingDateNumber) {
        const dateNumber = Number.parseInt(existingDateNumber, 10)
        if (!Number.isNaN(dateNumber) && dateNumber > 0) {
            // Store the mapping for this post to the existing date's puzzle number
            await redis.set(puzzleNumberKey(postId), existingDateNumber)
            return dateNumber
        }
    }

    // No existing number found, create a new one using atomic increment
    const newNumber = await redis.incrBy(PUZZLE_NUMBER_COUNTER_KEY, 1)

    // Store the mapping for both post and date
    const postKey = puzzleNumberKey(postId)
    await Promise.all([
        redis.set(postKey, newNumber.toString()),
        redis.set(dateKey, newNumber.toString())
    ])

    return newNumber
}
