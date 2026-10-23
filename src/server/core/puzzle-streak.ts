import { redis } from '@devvit/web/server'
import { toISODate } from '../../shared/baseline'
import { earnFreezeForRun } from '../../shared/growth'
import {
  computePuzzleStreak,
  MAX_STREAK_WINDOW_HOURS,
  walkStartDate,
  type PlayerRecord,
  type PostedNumber,
  type PuzzleStreak,
  type StreakClock,
} from '../../shared/streak'
import type { CoveredNumber, PuzzleStreakDetails, StreakData } from '../../shared/types/streak'
import { readSettings, type AppSettings } from '../lib/settings'
import { readIndexedPost, readPostedNumbers, readPostStamp } from './puzzle-number'
import {
  loadPuzzleStreakState,
  logFirstSolve,
  markStoredPuzzles,
  PUZZLE_STREAK_BOARD_KEY,
  readPuzzleStreakState,
  saveSolveOutcome,
  type PuzzleStreakState,
} from './puzzle-streak-state'

// The puzzle rule's streak (ENGAGEMENT_TASKS.md task 6): every solve is logged
// under either rule, and runs are computed when read (src/shared/streak.ts).

const MS_PER_SECOND = 1000
const SECONDS_PER_HOUR = 60 * 60
// The board recomputes this many of the best stored runs and lists the active ones.
const BOARD_CANDIDATES = 50

export type StreakSettings = Pick<AppSettings, 'streakRule' | 'streakWindowHours'>

/** The puzzle rule's streak as every streak surface shows it. */
export type PuzzleStreakData = StreakData & PuzzleStreakDetails

/** A solve's puzzle streak, with whether it earned a freeze. */
export type PuzzleSolveStreak = PuzzleStreakData & { earnedFreeze: boolean }

/** The streak settings, or null when the settings service fails; callers then show today's values. */
export const readStreakSettings = async (): Promise<StreakSettings | null> => {
  try {
    const { streakRule, streakWindowHours } = await readSettings()
    return { streakRule, streakWindowHours }
  } catch {
    return null
  }
}

const clockAt = (now: Date, windowHours: number): StreakClock => ({
  nowMs: now.getTime(),
  windowHours,
})

const readWalkNumbers = (state: PuzzleStreakState, now: Date): Promise<PostedNumber[]> =>
  readPostedNumbers(walkStartDate(state.seed), toISODate(now))

type CheckedStreak = { streak: PuzzleStreak; numbers: PostedNumber[] }

/**
 * Computes a streak, checking stored puzzles only for the missed numbers the
 * walk relied on: a date that stored none is skipped, not missed.
 */
const computeChecked = async (
  numbers: PostedNumber[],
  player: PlayerRecord,
  clock: StreakClock,
  viewedNumber?: number
): Promise<CheckedStreak> => {
  const streak = computePuzzleStreak(numbers, player, clock, viewedNumber)
  if (streak.unchecked.length === 0) return { streak, numbers }
  const checked = await markStoredPuzzles(numbers, streak.unchecked)
  return computeChecked(checked, player, clock, viewedNumber)
}

const toStreakData = (
  state: PuzzleStreakState,
  streak: PuzzleStreak,
  covered: CoveredNumber[] = [],
  freezes = state.freezes
): PuzzleStreakData => ({
  currentStreak: streak.current,
  longestStreak: Math.max(state.best, streak.current),
  todayCompleted: streak.todayCompleted,
  rule: 'puzzle',
  freezes,
  endedRun: streak.current === 0 ? streak.lastRun : 0,
  covered,
  stillCounts: streak.stillCounts
    ? {
        number: streak.stillCounts.number,
        postId: streak.stillCounts.postId,
        closesAt: new Date(streak.stillCounts.closesAtMs).toISOString(),
      }
    : null,
})

/** A player's puzzle streak for /api/streak, seeding it on their first read. */
export const readPuzzleStreak = async (
  userId: string,
  postId: string | undefined,
  now: Date,
  windowHours: number
): Promise<PuzzleStreakData> => {
  const state = await loadPuzzleStreakState(userId, now, windowHours)
  const [numbers, stamp] = await Promise.all([
    readWalkNumbers(state, now),
    postId ? readPostStamp(postId) : null,
  ])
  const { streak } = await computeChecked(numbers, state, clockAt(now, windowHours), stamp?.number)
  return toStreakData(state, streak)
}

type LoggedSolve = { number: number; isFirst: boolean }

// Logs a solve on a post stamped #N, timed from #N's indexed post (R5), so any
// post that shares #N counts and #N counts once.
const logSolve = async (userId: string, postId: string, now: Date): Promise<LoggedSolve | null> => {
  const stamp = await readPostStamp(postId)
  const indexed = stamp ? await readIndexedPost(stamp.number) : null
  if (!stamp || !indexed) return null
  const delaySeconds = Math.max(0, (now.getTime() - indexed.createdAt.getTime()) / MS_PER_SECOND)
  // No window is longer, so a later solve could never count.
  if (delaySeconds > MAX_STREAK_WINDOW_HOURS * SECONDS_PER_HOUR) return null
  return { number: stamp.number, isFirst: await logFirstSolve(userId, stamp.number, delaySeconds) }
}

const withoutSolve = (state: PuzzleStreakState, number: number): PuzzleStreakState => {
  const solveDelays = new Map(state.solveDelays)
  solveDelays.delete(number)
  return { ...state, solveDelays }
}

const coveredNumbers = (
  spent: readonly number[],
  numbers: readonly PostedNumber[]
): CoveredNumber[] =>
  numbers
    .filter(({ number }) => spent.includes(number))
    .map(({ number, date }) => ({ number, date }))
    .sort((a, b) => a.number - b.number)

/**
 * Records a solve for the puzzle rule. The solve is always logged. With the
 * window unknown (settings unreadable) nothing is seeded, spent or earned, and
 * this returns null. A first solve of #N spends freezes on the gaps its run
 * now spans and earns one when the run passes a multiple of five.
 */
export const recordPuzzleSolve = async ({
  userId,
  postId,
  now,
  windowHours,
}: {
  userId: string
  postId: string
  now: Date
  windowHours: number | null
}): Promise<PuzzleSolveStreak | null> => {
  const logged = await logSolve(userId, postId, now)
  if (windowHours === null) return null
  const state = await loadPuzzleStreakState(userId, now, windowHours)
  const clock = clockAt(now, windowHours)
  const after = await computeChecked(await readWalkNumbers(state, now), state, clock, logged?.number)
  if (!logged?.isFirst) return { ...toStreakData(state, after.streak), earnedFreeze: false }

  const before = await computeChecked(
    after.numbers,
    withoutSolve(state, logged.number),
    clock,
    logged.number
  )
  const spent = after.streak.toSpend
  const earned = earnFreezeForRun({
    previousRun: before.streak.current,
    currentRun: after.streak.current,
    currentFreezes: state.freezes - spent.length,
  })
  const best = Math.max(state.best, after.streak.current)
  await saveSolveOutcome(userId, { spent, freezes: earned.freezes, best, run: after.streak.current })

  return {
    ...toStreakData({ ...state, best }, after.streak, coveredNumbers(spent, after.numbers), earned.freezes),
    // Break copy belongs to the solve that starts again after a run ended.
    endedRun: before.streak.current === 0 ? before.streak.lastRun : 0,
    earnedFreeze: earned.earnedFreeze,
  }
}

/** A listed player's puzzle-rule streak, computed when read. */
export type BoardStreak = { userId: string; streak: number }

/**
 * The puzzle streak board: the best stored runs, and the viewer's, recomputed
 * when read; active streaks only, longest first. Reads only, so a player who
 * hasn't been seeded yet isn't listed.
 */
export const readPuzzleStreakBoard = async (
  viewerId: string | undefined,
  now: Date,
  windowHours: number
): Promise<BoardStreak[]> => {
  const candidates = await redis.zRange(PUZZLE_STREAK_BOARD_KEY, 0, BOARD_CANDIDATES - 1, {
    by: 'rank',
    reverse: true,
  })
  const userIds = new Set(candidates.map(({ member }) => member))
  if (viewerId) userIds.add(viewerId)
  const states = (await Promise.all([...userIds].map(readPuzzleStreakState))).filter(
    (state) => state !== null
  )
  const from = states.map(({ seed }) => walkStartDate(seed)).sort()[0]
  if (!from) return []

  const clock = clockAt(now, windowHours)
  const numbers = await readPostedNumbers(from, toISODate(now))
  // Puzzle checks are shared, so each date is read at most once per board.
  const storedPuzzles = new Map<number, boolean>()
  const streaks: BoardStreak[] = []
  for (const state of states) {
    const start = walkStartDate(state.seed)
    const own = numbers
      .filter(({ date }) => date >= start)
      .map((posted) => ({ ...posted, playable: storedPuzzles.get(posted.number) }))
    const { streak, numbers: checked } = await computeChecked(own, state, clock)
    for (const { number, playable } of checked) {
      if (playable !== undefined) storedPuzzles.set(number, playable)
    }
    if (streak.current > 0) streaks.push({ userId: state.userId, streak: streak.current })
  }
  return streaks.sort((a, b) => b.streak - a.streak)
}
