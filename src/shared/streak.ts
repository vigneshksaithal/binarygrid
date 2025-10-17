export type Streak = {
  current: number
  longest: number
  lastPlayed: string | null
}

export const DEFAULT_STREAK: Streak = {
  current: 0,
  longest: 0,
  lastPlayed: null
}

const clampCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.floor(value))
}

const coerceIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length !== 10) {
    return null
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return value
}

const diffInDays = (from: string | null, to: string): number | null => {
  const fromDate = from ? new Date(`${from}T00:00:00Z`) : null
  const toDate = new Date(`${to}T00:00:00Z`)
  if (
    Number.isNaN(toDate.getTime()) ||
    (from && Number.isNaN(fromDate?.getTime() ?? Number.NaN))
  ) {
    return null
  }
  if (!fromDate) {
    return null
  }
  const diff = toDate.getTime() - fromDate.getTime()
  return Math.round(diff / 86_400_000)
}

export const normalizeStreak = (input: unknown): Streak => {
  if (
    input &&
    typeof input === 'object' &&
    'current' in input &&
    'longest' in input &&
    'lastPlayed' in input
  ) {
    const current = clampCount((input as Streak).current)
    const longest = clampCount((input as Streak).longest)
    const lastPlayed = coerceIsoDate((input as Streak).lastPlayed) ?? null
    return {
      current,
      longest: Math.max(current, longest),
      lastPlayed
    }
  }
  return { ...DEFAULT_STREAK }
}

export const normalizeStreakFromRedis = (
  hash: Record<string, string> | null
): Streak => {
  if (!hash || Object.keys(hash).length === 0) {
    return { ...DEFAULT_STREAK }
  }
  return normalizeStreak({
    current: Number.parseInt(hash.current ?? '0', 10),
    longest: Number.parseInt(hash.longest ?? '0', 10),
    lastPlayed:
      hash.lastPlayed && hash.lastPlayed.length > 0 ? hash.lastPlayed : null
  })
}

export const serializeStreakForRedis = (
  streak: Streak
): Record<string, string> => ({
  current: streak.current.toString(),
  longest: streak.longest.toString(),
  lastPlayed: streak.lastPlayed ?? ''
})

export const computeNextStreak = (
  previous: Streak,
  completionDate: string
): Streak => {
  const targetDate = coerceIsoDate(completionDate) ?? completionDate

  if (previous.lastPlayed === targetDate) {
    return previous
  }

  const days = diffInDays(previous.lastPlayed, targetDate)
  let current = previous.current

  if (!previous.lastPlayed) {
    current = 1
  } else if (days === 1) {
    current = previous.current + 1
  } else if (typeof days === 'number' && days > 1) {
    current = 1
  } else {
    current = Math.max(previous.current, 1)
  }

  return {
    current,
    longest: Math.max(current, previous.longest),
    lastPlayed: targetDate
  }
}
