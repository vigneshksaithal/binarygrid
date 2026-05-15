import { redis } from '@devvit/web/server'
import type { Difficulty } from '../../shared/types/puzzle'
import {
  calculateFasterThanPercentile,
  DAILY_DIFFICULTIES,
  deriveSolveQuality,
  getDailyMissions,
  getDailyTrioSummary,
  normalizeSolveMetrics,
  updateStreakFreezeBalance,
  type DailyCompletion,
  type DailyCompletionMap,
  type SolveMetrics,
  type SolveQuality,
} from '../../shared/growth'
import {
  DECIMAL_RADIX,
  leaderboardKey,
  todayISO,
} from '../routes/utils'

export const GROWTH_EVENT_NAMES = [
  'app_open',
  'puzzle_start',
  'first_input',
  'submit_success',
  'leaderboard_open',
  'shop_open',
  'share_preview',
  'share_success',
  'join_click',
  'join_success',
  'mission_claim',
  'streak_saved',
] as const

export type GrowthEventName = (typeof GROWTH_EVENT_NAMES)[number]

const ANALYTICS_TTL_SECONDS = 60 * 60 * 24 * 60
const LEDGER_TTL_SECONDS = 60 * 60 * 24 * 180
const MAX_STREAK_FREEZES = 2

export type DailyProgress = {
  dateISO: string
  completedDifficulties: Difficulty[]
  trio: ReturnType<typeof getDailyTrioSummary>
  streak: {
    currentStreak: number
    longestStreak: number
    freezes: number
    todayCompleted: boolean
    repairAvailable: boolean
  }
  missions: ReturnType<typeof getDailyMissions>
}

export type PlayerContext = {
  rank: number | null
  totalEntries: number
  fasterThanPercentile: number
  nextRankSeconds: number | null
  topTenCutoffSeconds: number | null
  bestDifficultyToday: Difficulty | null
  completedDifficulties: Difficulty[]
}

export const isGrowthEventName = (value: string): value is GrowthEventName =>
  (GROWTH_EVENT_NAMES as readonly string[]).includes(value)

const dailyCompletedKey = (userId: string, dateISOValue: string): string =>
  `user:${userId}:daily:${dateISOValue}:completed`

export const economyLedgerKey = (userId: string, eventId: string): string =>
  `economy:ledger:${userId}:${eventId}`

const parseInteger = (value: string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback
  const parsed = Number.parseInt(value, DECIMAL_RADIX)
  return Number.isNaN(parsed) ? fallback : parsed
}

const parseCompletion = (value: string | undefined): DailyCompletion | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<DailyCompletion>
    if (
      typeof parsed.solveTimeSeconds === 'number' &&
      typeof parsed.solveQuality === 'string'
    ) {
      return {
        solveTimeSeconds: parsed.solveTimeSeconds,
        solveQuality: parsed.solveQuality as SolveQuality,
      }
    }
  } catch {
    // Ignore malformed stored completion values.
  }
  return null
}

const parseCompletedMap = (raw: Record<string, string>): DailyCompletionMap => {
  const completed: DailyCompletionMap = {}
  for (const difficulty of DAILY_DIFFICULTIES) {
    const completion = parseCompletion(raw[difficulty])
    if (completion) {
      completed[difficulty] = completion
    }
  }
  return completed
}

export const recordGrowthEvent = async (
  eventName: GrowthEventName,
  userId: string | undefined,
  dateISOValue = todayISO()
): Promise<void> => {
  const counterKey = `daily:${dateISOValue}:events:${eventName}`
  await redis.incrBy(counterKey, 1)
  await redis.expire(counterKey, ANALYTICS_TTL_SECONDS)

  if (userId) {
    const uniqueKey = `daily:${dateISOValue}:unique:${eventName}`
    await redis.hSet(uniqueKey, { [userId]: '1' })
    await redis.expire(uniqueKey, ANALYTICS_TTL_SECONDS)
  }
}

export const getUserDailyCompletions = async (
  userId: string,
  dateISOValue = todayISO()
): Promise<DailyCompletionMap> => {
  const raw = await redis.hGetAll(dailyCompletedKey(userId, dateISOValue))
  return parseCompletedMap(raw ?? {})
}

export const getDailyProgress = async (
  userId: string,
  dateISOValue = todayISO()
): Promise<DailyProgress> => {
  const [completed, currentRaw, longestRaw, freezesRaw, lastDate] = await Promise.all([
    getUserDailyCompletions(userId, dateISOValue),
    redis.get(`user:${userId}:streak:current`),
    redis.get(`user:${userId}:streak:longest`),
    redis.get(`user:${userId}:streak:freezes`),
    redis.get(`user:${userId}:streak:lastDate`),
  ])
  const trio = getDailyTrioSummary(completed)

  return {
    dateISO: dateISOValue,
    completedDifficulties: trio.completedDifficulties,
    trio,
    streak: {
      currentStreak: parseInteger(currentRaw),
      longestStreak: parseInteger(longestRaw),
      freezes: parseInteger(freezesRaw),
      todayCompleted: lastDate === dateISOValue,
      repairAvailable: false,
    },
    missions: getDailyMissions(dateISOValue),
  }
}

export const recordDailyCompletion = async ({
  userId,
  dateISOValue,
  difficulty,
  solveTimeSeconds,
  solveQuality,
}: {
  userId: string
  dateISOValue: string
  difficulty: Difficulty
  solveTimeSeconds: number
  solveQuality: SolveQuality
}): Promise<DailyProgress> => {
  const existing = await getUserDailyCompletions(userId, dateISOValue)
  const current = existing[difficulty]
  const shouldReplace = !current || solveTimeSeconds < current.solveTimeSeconds

  if (shouldReplace) {
    await redis.hSet(dailyCompletedKey(userId, dateISOValue), {
      [difficulty]: JSON.stringify({ solveTimeSeconds, solveQuality }),
    })
  }

  const progress = await getDailyProgress(userId, dateISOValue)
  if (progress.trio.trioComplete) {
    await redis.zAdd(`leaderboard:daily-trio:${dateISOValue}`, {
      member: userId,
      score: progress.trio.totalSolveTimeSeconds,
    })
  }
  return progress
}

export const normalizeAndLabelSolve = (metrics: {
  hintsUsed?: number | undefined
  mistakeCount?: number | undefined
  undoCount?: number | undefined
}): {
  metrics: SolveMetrics
  solveQuality: SolveQuality
} => {
  const normalized = normalizeSolveMetrics(metrics)
  return {
    metrics: normalized,
    solveQuality: deriveSolveQuality(normalized),
  }
}

export const consumeStreakFreeze = async (userId: string): Promise<boolean> => {
  const currentFreezes = parseInteger(await redis.get(`user:${userId}:streak:freezes`))
  if (currentFreezes <= 0) return false
  await redis.set(`user:${userId}:streak:freezes`, `${currentFreezes - 1}`)
  return true
}

export const updateEarnedStreakFreeze = async (
  userId: string,
  currentStreak: number
): Promise<{ freezes: number; earnedFreeze: boolean }> => {
  const currentFreezes = parseInteger(await redis.get(`user:${userId}:streak:freezes`))
  const update = updateStreakFreezeBalance({ currentStreak, currentFreezes })
  const freezes = Math.min(update.freezes, MAX_STREAK_FREEZES)
  if (freezes !== currentFreezes) {
    await redis.set(`user:${userId}:streak:freezes`, freezes.toString())
  }
  return { freezes, earnedFreeze: update.earnedFreeze }
}

const getBestDifficulty = (completed: DailyCompletionMap): Difficulty | null => {
  let best: { difficulty: Difficulty; time: number } | null = null
  for (const difficulty of DAILY_DIFFICULTIES) {
    const completion = completed[difficulty]
    if (completion && (!best || completion.solveTimeSeconds < best.time)) {
      best = { difficulty, time: completion.solveTimeSeconds }
    }
  }
  return best?.difficulty ?? null
}

export const getPlayerContext = async (
  userId: string,
  puzzleId: string,
  dateISOValue = todayISO()
): Promise<PlayerContext> => {
  const key = leaderboardKey(puzzleId)
  const [rankIndex, score, totalEntries, topTenEntries, completed] = await Promise.all([
    redis.zRank(key, userId),
    redis.zScore(key, userId),
    redis.zCard(key),
    redis.zRange(key, 9, 9, { by: 'rank' }),
    getUserDailyCompletions(userId, dateISOValue),
  ])
  const rank = rankIndex !== undefined && rankIndex !== null ? rankIndex + 1 : null
  const nextRankSeconds = await getNextRankSeconds(key, rankIndex, score)

  return {
    rank,
    totalEntries,
    fasterThanPercentile: calculateFasterThanPercentile(rank, totalEntries),
    nextRankSeconds,
    topTenCutoffSeconds: topTenEntries[0]?.score ?? null,
    bestDifficultyToday: getBestDifficulty(completed),
    completedDifficulties: getDailyTrioSummary(completed).completedDifficulties,
  }
}

const getNextRankSeconds = async (
  key: string,
  rankIndex: number | undefined | null,
  score: number | undefined | null
): Promise<number | null> => {
  if (rankIndex === undefined || rankIndex === null || rankIndex <= 0 || score === undefined || score === null) {
    return null
  }
  const nextRank = await redis.zRange(key, rankIndex - 1, rankIndex - 1, {
    by: 'rank',
  })
  const targetScore = nextRank[0]?.score
  return targetScore === undefined ? null : Math.max(0, score - targetScore)
}

export const markLedgerEvent = async (key: string): Promise<boolean> => {
  const exists = await redis.get(key)
  if (exists) return false
  await redis.set(key, '1')
  await redis.expire(key, LEDGER_TTL_SECONDS)
  return true
}
