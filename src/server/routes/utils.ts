import type { Difficulty } from '../../shared/types/puzzle'

export const HTTP_BAD_REQUEST = 400
export const HTTP_OK = 200
export const DEFAULT_GRID_SIZE = 6
export const DECIMAL_RADIX = 10
export const GRID_SIZE_TYPE = 6
export const DEFAULT_DIFFICULTY: Difficulty = 'medium'
export const DIFFICULTY_VALUES = ['easy', 'medium', 'hard']
export const LEADERBOARD_DEFAULT_PAGE_SIZE = 5
export const LEADERBOARD_MAX_PAGE_SIZE = 10
export const CACHE_TTL_ONE_DAY = 86400

export type StoredLeaderboardMeta = {
  username: string
  avatarUrl: string | null
}

export const isDifficultyValue = (value: string): value is Difficulty =>
  (DIFFICULTY_VALUES as readonly string[]).includes(value)

export const resolveDifficulty = (value: string | null): Difficulty => {
  if (!value) {
    return DEFAULT_DIFFICULTY
  }
  const normalized = value.toLowerCase()
  return isDifficultyValue(normalized) ? normalized : DEFAULT_DIFFICULTY
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10)

export const resolveDate = (value: string | null): string => {
  if (!value) {
    return todayISO()
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return todayISO()
  }
  return parsed.toISOString().slice(0, 10)
}

export const leaderboardKey = (puzzleId: string): string => `leaderboard:${puzzleId}`

export const leaderboardMetaKey = (puzzleId: string): string =>
  `leaderboard:${puzzleId}:meta`

export const clampPageSize = (value: number | null | undefined): number => {
  if (!value || Number.isNaN(value)) {
    return LEADERBOARD_DEFAULT_PAGE_SIZE
  }
  return Math.min(Math.max(value, 1), LEADERBOARD_MAX_PAGE_SIZE)
}

export const parseLeaderboardMeta = (
  value: string | null | undefined
): StoredLeaderboardMeta => {
  if (!value) {
    return { username: 'Unknown player', avatarUrl: null }
  }
  try {
    const parsed = JSON.parse(value) as StoredLeaderboardMeta
    if (
      typeof parsed.username === 'string' &&
      (parsed.avatarUrl === null || typeof parsed.avatarUrl === 'string')
    ) {
      return parsed
    }
  } catch {
    // ignore malformed JSON payloads
  }
  return { username: 'Unknown player', avatarUrl: null }
}

export const ensurePostIdPrefix = (id: string): `t3_${string}` =>
  id.startsWith('t3_') ? (id as `t3_${string}`) : `t3_${id}`
