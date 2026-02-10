type StreakState = {
  lastSolvedDate: string | null
  currentStreak: number
  bestStreak: number
}

type StreakResult = {
  nextState: StreakState
  streak: number
  bestStreak: number
  isNewDay: boolean
}

const toUtcDate = (date: Date): string => date.toISOString().slice(0, 10)

const addDaysUtc = (dateISO: string, days: number): string => {
  const date = new Date(`${dateISO}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return toUtcDate(date)
}

const isConsecutiveDay = (previous: string, current: string): boolean =>
  addDaysUtc(previous, 1) === current

export const computeStreakUpdate = (
  previous: StreakState,
  currentDateISO: string
): StreakResult => {
  const lastSolvedDate = previous.lastSolvedDate

  if (lastSolvedDate === currentDateISO) {
    return {
      nextState: previous,
      streak: previous.currentStreak,
      bestStreak: previous.bestStreak,
      isNewDay: false
    }
  }

  const shouldContinue =
    lastSolvedDate !== null && isConsecutiveDay(lastSolvedDate, currentDateISO)

  const nextStreak = shouldContinue ? previous.currentStreak + 1 : 1
  const nextBest = Math.max(previous.bestStreak, nextStreak)

  return {
    nextState: {
      lastSolvedDate: currentDateISO,
      currentStreak: nextStreak,
      bestStreak: nextBest
    },
    streak: nextStreak,
    bestStreak: nextBest,
    isNewDay: true
  }
}

export type { StreakState, StreakResult }
