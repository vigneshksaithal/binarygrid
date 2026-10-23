import { redis } from '@devvit/web/server'
import { addDays } from '../../shared/baseline'
import type { Difficulty } from '../../shared/types/puzzle'
import { getOrCreateDateNumber, stampPost } from '../core/puzzle-number'
import { getOrCreatePuzzleSet, type DatePuzzle } from '../core/puzzle-set'

// Numbered daily posts for streak tests, stored through task 5's own modules so
// they work with either Devvit fake. #N posts at 08:00 UTC on 2026-10-(N − 106):
// #126 is Tuesday 2026-10-20, #127 Wednesday 2026-10-21, #128 Thursday 2026-10-22.

const HOUR_MS = 60 * 60 * 1000

export const dateOf = (number: number): string => addDays('2026-10-22', number - 128)

export const postIdOf = (number: number): string => `t3_post${number}`

export const postedAt = (number: number): Date => new Date(`${dateOf(number)}T08:00:00.000Z`)

export const hoursAfterPost = (number: number, hours: number): Date =>
  new Date(postedAt(number).getTime() + hours * HOUR_MS)

const storedPuzzle = (difficulty: Difficulty): DatePuzzle => ({
  size: 6,
  difficulty,
  fixed: [],
  initial: [],
})

/**
 * Posts #first to #last the way createPost does: one number per date, minted
 * through the date key, stamped and indexed at 08:00 UTC, and the date's puzzles
 * stored unless the number is listed in `withoutPuzzles`.
 */
export const postNumbers = async (
  first: number,
  last: number,
  withoutPuzzles: readonly number[] = []
): Promise<void> => {
  await redis.set('puzzle:number:counter', `${first - 1}`)
  const numbers = Array.from({ length: last - first + 1 }, (_, offset) => first + offset)
  for (const number of numbers) {
    await getOrCreateDateNumber(dateOf(number))
    await stampPost(postIdOf(number), number, postedAt(number))
    if (!withoutPuzzles.includes(number)) {
      await getOrCreatePuzzleSet(dateOf(number), storedPuzzle)
    }
  }
}

export type CalendarCounters = {
  current: number
  longest: number
  lastDate: string
  freezes: number
}

/** Saves a player's calendar-rule counters as today's submit code leaves them. */
export const saveCalendarStreak = async (
  userId: string,
  { current, longest, lastDate, freezes }: CalendarCounters
): Promise<void> => {
  await redis.set(`user:${userId}:streak:current`, `${current}`)
  await redis.set(`user:${userId}:streak:longest`, `${longest}`)
  await redis.set(`user:${userId}:streak:lastDate`, lastDate)
  await redis.set(`user:${userId}:streak:freezes`, `${freezes}`)
}

/** The calendar-rule counters as stored, for checking they changed exactly as before. */
export const readCalendarStreak = async (userId: string) => ({
  current: (await redis.get(`user:${userId}:streak:current`)) ?? null,
  longest: (await redis.get(`user:${userId}:streak:longest`)) ?? null,
  lastDate: (await redis.get(`user:${userId}:streak:lastDate`)) ?? null,
  freezes: (await redis.get(`user:${userId}:streak:freezes`)) ?? null,
  board: (await redis.zScore('leaderboard:streaks', userId)) ?? null,
})
