import { redis } from '@devvit/web/server'
import { listDates } from '../../shared/baseline'
import type { PostedNumber } from '../../shared/streak'
import { DECIMAL_RADIX } from '../routes/utils'

/**
 * Redis key patterns for puzzle numbering:
 * - puzzle:number:counter — Global counter for puzzle numbers
 * - puzzle:number:{postId} — Maps postId to its puzzle number
 * - puzzle:number:date:{dateISO} — Maps date to puzzle number (for daily puzzles)
 * - post:{postId}:createdAt — When createPost created the post (ISO time). Only
 *   stamped posts have it; older posts got their number lazily.
 * - puzzle:post:{N} — #N's indexed post: the first post stamped with N
 */

const PUZZLE_NUMBER_COUNTER_KEY = 'puzzle:number:counter'

const puzzleNumberKey = (postId: string): string =>
    `puzzle:number:${postId}`

const puzzleDateKey = (dateISO: string): string =>
    `puzzle:number:date:${dateISO}`

const postCreatedAtKey = (postId: string): string => `post:${postId}:createdAt`

const indexedPostKey = (number: number): string => `puzzle:post:${number}`

/** A stored number, or 0 when the key is missing or unreadable. */
const parseNumber = (value: string | null | undefined): number => {
    if (!value) return 0
    const parsed = Number.parseInt(value, DECIMAL_RADIX)
    return Number.isNaN(parsed) ? 0 : parsed
}

const parseTime = (value: string | null | undefined): Date | null => {
    if (!value) return null
    const time = new Date(value)
    return Number.isNaN(time.getTime()) ? null : time
}

/** A stamped post's #N and when createPost created it. */
export type PostStamp = { number: number; createdAt: Date }

/** #N's indexed post, the first post stamped with N, and its creation time. */
export type IndexedPost = { postId: string; createdAt: Date }

/**
 * Retrieves the puzzle number for a given post.
 * Returns the puzzle number if it exists, or 0 if not found.
 */
export const getPuzzleNumber = async (postId: string): Promise<number> =>
    parseNumber(await redis.get(puzzleNumberKey(postId)))

/**
 * Mints #N for a UTC date through the date key, once: every post and every
 * lazy fallback on that date gets the same number (N-7 (a)). If two first
 * mints race, the number stored first wins and the other counter value is
 * skipped, so a date never has two numbers.
 */
export const getOrCreateDateNumber = async (dateISO: string): Promise<number> => {
    const dateKey = puzzleDateKey(dateISO)
    const existing = parseNumber(await redis.get(dateKey))
    if (existing > 0) return existing

    const minted = await redis.incrBy(PUZZLE_NUMBER_COUNTER_KEY, 1)
    if (await redis.set(dateKey, minted.toString(), { nx: true })) return minted

    const stored = parseNumber(await redis.get(dateKey))
    if (stored > 0) return stored
    throw new Error(`No puzzle number could be stored for ${dateISO}`)
}

/**
 * Gets an existing puzzle number or creates a new one for the given post.
 * createPost stamps every new post, so this mints only for posts created
 * before stamping: they take the number of the date they are first seen.
 *
 * @param postId - The Reddit post ID
 * @param dateISO - The date in ISO format (YYYY-MM-DD)
 * @returns The puzzle number (existing or newly assigned)
 */
export const getOrCreatePuzzleNumber = async (
    postId: string,
    dateISO: string
): Promise<number> => {
    const existingNumber = await getPuzzleNumber(postId)
    if (existingNumber > 0) {
        return existingNumber
    }

    const dateNumber = await getOrCreateDateNumber(dateISO)
    await redis.set(puzzleNumberKey(postId), dateNumber.toString())
    return dateNumber
}

/**
 * Stamps a new post with its date's #N and creation time, and makes it #N's
 * indexed post unless an earlier post that date already is. The index is
 * written last, so an indexed post always has its creation time.
 */
export const stampPost = async (
    postId: string,
    number: number,
    createdAt: Date
): Promise<void> => {
    await redis.set(puzzleNumberKey(postId), number.toString())
    await redis.set(postCreatedAtKey(postId), createdAt.toISOString())
    await redis.set(indexedPostKey(number), postId, { nx: true })
}

/** A post's stamp, or null for a post createPost didn't stamp. */
export const readPostStamp = async (postId: string): Promise<PostStamp | null> => {
    const [numberValue, createdAtValue] = await Promise.all([
        redis.get(puzzleNumberKey(postId)),
        redis.get(postCreatedAtKey(postId))
    ])
    const number = parseNumber(numberValue)
    const createdAt = parseTime(createdAtValue)
    return number > 0 && createdAt ? { number, createdAt } : null
}

/** #N's indexed post, or null when no post was stamped with N. */
export const readIndexedPost = async (number: number): Promise<IndexedPost | null> => {
    const postId = await redis.get(indexedPostKey(number))
    if (!postId) return null
    const createdAt = parseTime(await redis.get(postCreatedAtKey(postId)))
    return createdAt ? { postId, createdAt } : null
}

const readMany = async (keys: readonly string[]): Promise<(string | null)[]> =>
    keys.length > 0 ? redis.mGet([...keys]) : []

/**
 * The numbers posted from `from` to `to` (UTC dates), newest first: each date's
 * #N with its indexed post and creation time. Dates without one are left out.
 * Three batched reads, whatever the range.
 */
export const readPostedNumbers = async (from: string, to: string): Promise<PostedNumber[]> => {
    const dates = listDates(from, to).reverse()
    const numbers = await readMany(dates.map(puzzleDateKey))
    const minted = dates.flatMap((date, index) => {
        const number = parseNumber(numbers[index])
        return number > 0 ? [{ date, number }] : []
    })
    const postIds = await readMany(minted.map(({ number }) => indexedPostKey(number)))
    const indexed = minted.flatMap((entry, index) => {
        const postId = postIds[index]
        return postId ? [{ ...entry, postId }] : []
    })
    const times = await readMany(indexed.map(({ postId }) => postCreatedAtKey(postId)))
    return indexed.flatMap((entry, index) => {
        const createdAt = parseTime(times[index])
        return createdAt ? [{ ...entry, createdAtMs: createdAt.getTime() }] : []
    })
}
