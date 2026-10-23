import { writable, type Writable } from 'svelte/store'
import type { CoveredNumber, StillCounts, StreakData } from '../../shared/types/streak'
import type { DailyProgress } from './growth'

export type StreakState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: StreakData
}

const NO_STREAK: StreakData = { currentStreak: 0, longestStreak: 0, todayCompleted: false }

const initial: StreakState = {
  status: 'idle',
  data: NO_STREAK
}

export const streakStore: Writable<StreakState> = writable<StreakState>({ ...initial })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const countOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const isCoveredNumber = (value: unknown): value is CoveredNumber =>
  isRecord(value) && typeof value.number === 'number' && typeof value.date === 'string'

const parseStillCounts = (value: unknown): StillCounts | null =>
  isRecord(value) &&
  typeof value.number === 'number' &&
  typeof value.postId === 'string' &&
  typeof value.closesAt === 'string'
    ? { number: value.number, postId: value.postId, closesAt: value.closesAt }
    : null

/** Reads a streak from /api/streak or /api/submit. Only the puzzle rule adds its details. */
export const parseStreakData = (raw: unknown): StreakData => {
  if (!isRecord(raw)) return { ...NO_STREAK }
  const streak: StreakData = {
    currentStreak: countOrZero(raw.currentStreak),
    longestStreak: countOrZero(raw.longestStreak),
    todayCompleted: raw.todayCompleted === true
  }
  if (raw.rule !== 'puzzle') return streak
  return {
    ...streak,
    rule: 'puzzle',
    freezes: countOrZero(raw.freezes),
    endedRun: countOrZero(raw.endedRun),
    covered: Array.isArray(raw.covered) ? raw.covered.filter(isCoveredNumber) : [],
    stillCounts: parseStillCounts(raw.stillCounts)
  }
}

/**
 * The streak the result screen shows: the puzzle rule's own, or under the
 * calendar rule the daily progress's counter first, as before.
 */
export const shownStreak = (data: StreakData, dailyProgress: DailyProgress | null): number =>
  data.rule === 'puzzle' ? data.currentStreak : (dailyProgress?.streak.currentStreak ?? data.currentStreak)

/** The freeze balance the result screen shows, from the same rule as the streak. */
export const shownFreezes = (data: StreakData, dailyProgress: DailyProgress | null): number =>
  data.rule === 'puzzle' ? (data.freezes ?? 0) : (dailyProgress?.streak.freezes ?? 0)

export const fetchStreak = async (): Promise<void> => {
  streakStore.update(s => ({ ...s, status: 'loading' }))
  try {
    const res = await fetch('/api/streak')
    if (!res.ok) throw new Error('Failed')
    streakStore.set({ status: 'ready', data: parseStreakData(await res.json()) })
  } catch {
    streakStore.update(s => ({ ...s, status: 'error' }))
  }
}

/** Shows the streak a saved solve returned, read the same way as /api/streak. */
export const updateStreakFromSubmit = (streak: unknown) => {
  streakStore.set({ status: 'ready', data: parseStreakData(streak) })
}
