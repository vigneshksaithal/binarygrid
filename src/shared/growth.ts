import type { Difficulty } from './types/puzzle'

export type SolveQuality = 'clean' | 'sharp' | 'comeback' | 'assisted'

export type SolveMetrics = {
  hintsUsed: number
  mistakeCount: number
  undoCount: number
}

export type DailyCompletion = {
  solveTimeSeconds: number
  solveQuality: SolveQuality
  /** The rules the label was counted under; see SCORING_VERSION. */
  scoringVersion: number
}

export type DailyCompletionMap = Partial<Record<Difficulty, DailyCompletion>>

export type DailyTrioSummary = {
  completedDifficulties: Difficulty[]
  completedCount: number
  trioComplete: boolean
  perfectDay: boolean
  totalSolveTimeSeconds: number
}

export type DailyMission = {
  id: string
  label: string
  description: string
}

export type StreakFreezeUpdate = {
  freezes: number
  earnedFreeze: boolean
}

export const DAILY_DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/**
 * Version of the rules behind the solve labels, sent with each solve and
 * stored with each completion so Clean rates are only compared within one
 * version. Version 1 charged every rule-breaking tap; version 2 charges only a
 * violation left standing (src/shared/clean.ts). Bump it whenever that rule or
 * deriveSolveQuality changes.
 */
export const SCORING_VERSION = 2

/** Solves and completions that carry no version were scored by version 1. */
export const LEGACY_SCORING_VERSION = 1

export const SOLVE_QUALITY_LABELS: Record<SolveQuality, string> = {
  clean: 'Clean Solve',
  sharp: 'Sharp Solve',
  comeback: 'Comeback Solve',
  assisted: 'Assisted Solve',
}

// Shown under the earned label and in How to Play. deriveSolveQuality reads
// them from the bottom up: a hint makes any solve Assisted, then a line left
// broken makes it a Comeback, then an undo makes it Sharp.
export const SOLVE_QUALITY_DEFINITIONS: Record<SolveQuality, string> = {
  clean: 'Clean: no hints, no undos, never left a broken line.',
  sharp: 'Sharp: used undo, never left a broken line.',
  comeback: 'Comeback: left a broken line, then fixed it.',
  assisted: 'Assisted: used a hint.',
}

const MAX_STREAK_FREEZES = 2
const FREEZE_EARN_INTERVAL = 5

const clampMetric = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0

export const normalizeSolveMetrics = (metrics: {
  hintsUsed?: number | undefined
  mistakeCount?: number | undefined
  undoCount?: number | undefined
}): SolveMetrics => ({
  hintsUsed: clampMetric(metrics.hintsUsed ?? 0),
  mistakeCount: clampMetric(metrics.mistakeCount ?? 0),
  undoCount: clampMetric(metrics.undoCount ?? 0),
})

export const deriveSolveQuality = (metrics: SolveMetrics): SolveQuality => {
  const normalized = normalizeSolveMetrics(metrics)
  if (normalized.hintsUsed > 0) return 'assisted'
  if (normalized.mistakeCount > 0) return 'comeback'
  if (normalized.undoCount > 0) return 'sharp'
  return 'clean'
}

export const calculateFasterThanPercentile = (
  rank: number | null,
  totalEntries: number
): number => {
  if (rank === null || totalEntries <= 0 || rank < 1) return 0
  if (totalEntries === 1) return 100
  return Math.max(0, Math.round(((totalEntries - rank) / totalEntries) * 100))
}

export const getDailyTrioSummary = (
  completed: DailyCompletionMap
): DailyTrioSummary => {
  const completedDifficulties = DAILY_DIFFICULTIES.filter(
    (difficulty) => completed[difficulty] !== undefined
  )
  const totalSolveTimeSeconds = completedDifficulties.reduce(
    (total, difficulty) => total + (completed[difficulty]?.solveTimeSeconds ?? 0),
    0
  )
  const trioComplete = completedDifficulties.length === DAILY_DIFFICULTIES.length
  const perfectDay =
    trioComplete &&
    DAILY_DIFFICULTIES.every(
      (difficulty) => completed[difficulty]?.solveQuality === 'clean'
    )

  return {
    completedDifficulties,
    completedCount: completedDifficulties.length,
    trioComplete,
    perfectDay,
    totalSolveTimeSeconds,
  }
}

const rotatingMissions: readonly DailyMission[] = [
  {
    id: 'clean_solve',
    label: 'Clean grid',
    description: 'Solve any difficulty with no hints, mistakes, or undos.',
  },
  {
    id: 'hard_clear',
    label: 'Hard clear',
    description: 'Finish the hard puzzle today.',
  },
  {
    id: 'two_difficulties',
    label: 'Double solve',
    description: 'Complete any two difficulties today.',
  },
  {
    id: 'no_hints',
    label: 'Logic only',
    description: 'Finish a puzzle without using hints.',
  },
  {
    id: 'daily_trio',
    label: 'Daily trio',
    description: 'Complete easy, medium, and hard today.',
  },
]

const stableDateSeed = (dateISO: string): number => {
  let seed = 0
  for (const char of dateISO) {
    seed += char.charCodeAt(0)
  }
  return seed
}

export const getDailyMissions = (dateISO: string): DailyMission[] => {
  const baseMission: DailyMission = {
    id: 'solve_today',
    label: 'Daily solve',
    description: 'Complete any Binary Grid puzzle today.',
  }
  const seed = stableDateSeed(dateISO)
  const first = rotatingMissions[seed % rotatingMissions.length]!
  const second = rotatingMissions[(seed + 2) % rotatingMissions.length]!

  return [baseMission, first, second]
}

export const getUTCWeekId = (date = new Date()): string => {
  const working = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ))
  const day = working.getUTCDay() || 7
  working.setUTCDate(working.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((working.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${working.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export const updateStreakFreezeBalance = ({
  currentStreak,
  currentFreezes,
}: {
  currentStreak: number
  currentFreezes: number
}): StreakFreezeUpdate => {
  const canEarn =
    currentStreak > 0 &&
    currentStreak % FREEZE_EARN_INTERVAL === 0 &&
    currentFreezes < MAX_STREAK_FREEZES

  return {
    freezes: canEarn ? currentFreezes + 1 : currentFreezes,
    earnedFreeze: canEarn,
  }
}

/**
 * The puzzle rule's freeze earning: one freeze when a solve's run passes a
 * multiple of five, capped at two. A run can grow by more than one when a solve
 * joins two parts, so this checks for passing a multiple rather than landing on it.
 */
export const earnFreezeForRun = ({
  previousRun,
  currentRun,
  currentFreezes,
}: {
  previousRun: number
  currentRun: number
  currentFreezes: number
}): StreakFreezeUpdate => {
  const passedMultiple =
    Math.floor(currentRun / FREEZE_EARN_INTERVAL) > Math.floor(previousRun / FREEZE_EARN_INTERVAL)
  const canEarn = currentRun > 0 && passedMultiple && currentFreezes < MAX_STREAK_FREEZES

  return {
    freezes: canEarn ? currentFreezes + 1 : currentFreezes,
    earnedFreeze: canEarn,
  }
}
