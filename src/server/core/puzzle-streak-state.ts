import { redis } from '@devvit/web/server'
import { addDays, toISODate } from '../../shared/baseline'
import {
  planSeed,
  SEED_LOOKBACK_DAYS,
  type CalendarCounters,
  type PlayerRecord,
  type PostedNumber,
  type StreakClock,
} from '../../shared/streak'
import { DECIMAL_RADIX } from '../routes/utils'
import { readPostedNumbers } from './puzzle-number'
import { readDatesWithPuzzles } from './puzzle-set'

// The puzzle rule's per-player keys (ENGAGEMENT_TASKS.md task 6). Today's
// calendar-rule keys are only read here, once, to seed; they are never written.
// - user:{id}:streak:log — sorted set: #N → seconds from #N's indexed post to the first solve
// - user:{id}:streak:frozen — sorted set: #N → #N, numbers a spent freeze covered
// - user:{id}:streak:puzzle — hash: seed (JSON, written once), freezes, best
// - leaderboard:streaks:puzzle — sorted set: userId → run after the last credited solve

export const PUZZLE_STREAK_BOARD_KEY = 'leaderboard:streaks:puzzle'

const logKey = (userId: string): string => `user:${userId}:streak:log`
const frozenKey = (userId: string): string => `user:${userId}:streak:frozen`
const stateKey = (userId: string): string => `user:${userId}:streak:puzzle`

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** The calendar counters a seed read, what it carried over, and when. Written once. */
export type StoredSeed = CalendarCounters & { run: number; charged: number; seededAt: string }

export type PuzzleStreakState = PlayerRecord & {
  userId: string
  seed: StoredSeed
  best: number
}

const parseCount = (value: string | null | undefined): number => {
  const parsed = Number.parseInt(value ?? '', DECIMAL_RADIX)
  return Number.isNaN(parsed) ? 0 : parsed
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const parseSeedJSON = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const parseSeed = (value: string | undefined): StoredSeed | null => {
  const seed = value ? parseSeedJSON(value) : null
  if (!isRecord(seed)) return null
  const { current, longest, lastDate, freezes, run, charged, seededAt } = seed
  if (!isNumber(current) || !isNumber(longest) || !isNumber(freezes)) return null
  if (!isNumber(run) || !isNumber(charged) || typeof seededAt !== 'string') return null
  if (lastDate !== null && typeof lastDate !== 'string') return null
  return { current, longest, lastDate, freezes, run, charged, seededAt }
}

/** A player's puzzle-rule state, or null before their first touch seeded it. Reads only. */
export const readPuzzleStreakState = async (userId: string): Promise<PuzzleStreakState | null> => {
  const [fields, log, frozen] = await Promise.all([
    redis.hGetAll(stateKey(userId)),
    redis.zRange(logKey(userId), 0, -1, { by: 'rank' }),
    redis.zRange(frozenKey(userId), 0, -1, { by: 'rank' }),
  ])
  const seed = parseSeed(fields.seed)
  if (!seed) return null
  return {
    userId,
    seed,
    seedRun: seed.run,
    freezes: parseCount(fields.freezes),
    best: parseCount(fields.best),
    solveDelays: new Map(log.map(({ member, score }) => [parseCount(member), score])),
    frozen: new Set(frozen.map(({ member }) => parseCount(member))),
  }
}

const readCalendarCounters = async (userId: string): Promise<CalendarCounters> => {
  const [current, longest, lastDate, freezes] = await redis.mGet([
    `user:${userId}:streak:current`,
    `user:${userId}:streak:longest`,
    `user:${userId}:streak:lastDate`,
    `user:${userId}:streak:freezes`,
  ])
  return {
    current: parseCount(current),
    longest: parseCount(longest),
    lastDate: lastDate && ISO_DATE_PATTERN.test(lastDate) ? lastDate : null,
    freezes: parseCount(freezes),
  }
}

/** Marks the given numbers by whether their date stored puzzles. */
export const markStoredPuzzles = async (
  numbers: readonly PostedNumber[],
  toCheck: readonly number[]
): Promise<PostedNumber[]> => {
  const checking = new Set(toCheck)
  const withPuzzles = await readDatesWithPuzzles(
    numbers.filter(({ number }) => checking.has(number)).map(({ date }) => date)
  )
  return numbers.map((posted) =>
    checking.has(posted.number) ? { ...posted, playable: withPuzzles.has(posted.date) } : posted
  )
}

// The numbers posted after the last calendar solve, puzzles checked, for planSeed.
// Older runs can't carry over, so the read stops SEED_LOOKBACK_DAYS back.
const readNumbersSince = async (lastDate: string, now: Date): Promise<PostedNumber[]> => {
  const today = toISODate(now)
  const lookbackStart = addDays(today, -SEED_LOOKBACK_DAYS)
  const dayAfterLastSolve = addDays(lastDate, 1)
  const from = dayAfterLastSolve > lookbackStart ? dayAfterLastSolve : lookbackStart
  const numbers = await readPostedNumbers(from, today)
  return markStoredPuzzles(
    numbers,
    numbers.map(({ number }) => number)
  )
}

/**
 * Seeds a player's puzzle-rule streak from today's counters, once (a one-way
 * door). The freeze balance and best go first and the seed last, each with
 * hSetNX, so a repeated or racing first touch seeds exactly once.
 */
const seedPuzzleStreak = async (userId: string, now: Date, clock: StreakClock): Promise<void> => {
  const counters = await readCalendarCounters(userId)
  const numbers =
    counters.current > 0 && counters.lastDate ? await readNumbersSince(counters.lastDate, now) : []
  const plan = planSeed(counters, numbers, clock)
  const seed: StoredSeed = { ...counters, ...plan, seededAt: now.toISOString() }

  await redis.hSetNX(stateKey(userId), 'freezes', `${counters.freezes - plan.charged}`)
  await redis.hSetNX(stateKey(userId), 'best', `${Math.max(counters.longest, counters.current)}`)
  const seeded = await redis.hSetNX(stateKey(userId), 'seed', JSON.stringify(seed))
  if (seeded && plan.run > 0) {
    await redis.zAdd(PUZZLE_STREAK_BOARD_KEY, { member: userId, score: plan.run })
  }
}

/** A player's puzzle-rule state, seeding it on their first touch. */
export const loadPuzzleStreakState = async (
  userId: string,
  now: Date,
  windowHours: number
): Promise<PuzzleStreakState> => {
  const existing = await readPuzzleStreakState(userId)
  if (existing) return existing
  await seedPuzzleStreak(userId, now, { nowMs: now.getTime(), windowHours })
  const seeded = await readPuzzleStreakState(userId)
  if (!seeded) throw new Error('The puzzle streak could not be seeded')
  return seeded
}

/** Logs a player's first solve of #N. False when #N was already logged, so it counts once. */
export const logFirstSolve = async (
  userId: string,
  number: number,
  delaySeconds: number
): Promise<boolean> => {
  const logged = await redis.zScore(logKey(userId), `${number}`)
  if (typeof logged === 'number') return false
  await redis.zAdd(logKey(userId), { member: `${number}`, score: delaySeconds })
  return true
}

export type SolveOutcome = { spent: readonly number[]; freezes: number; best: number; run: number }

/** Saves what a credited solve changed: covered numbers, balance, best and board entry. */
export const saveSolveOutcome = async (
  userId: string,
  { spent, freezes, best, run }: SolveOutcome
): Promise<void> => {
  if (spent.length > 0) {
    await redis.zAdd(frozenKey(userId), ...spent.map((number) => ({ member: `${number}`, score: number })))
  }
  await redis.hSet(stateKey(userId), { freezes: `${freezes}`, best: `${best}` })
  await redis.zAdd(PUZZLE_STREAK_BOARD_KEY, { member: userId, score: run })
}
