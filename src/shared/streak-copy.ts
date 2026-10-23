import type { CoveredNumber, StreakData } from './types/streak'

// Player-facing streak lines for the puzzle rule. The calendar rule shows none,
// as before. Break copy names what was kept, never what was lost (report I2).

const MS_PER_MINUTE = 60 * 1000
const MINUTES_PER_HOUR = 60

const weekdayOf = (date: string): string =>
  new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  })

const joinWithAnd = (items: readonly string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join('')

/** "❄️ A freeze covered Tuesday. 24-day streak safe.", naming the covered days oldest first. */
export const formatFreezeMessage = (
  covered: readonly CoveredNumber[],
  currentStreak: number
): string => {
  const days = [...covered].sort((a, b) => a.number - b.number).map(({ date }) => weekdayOf(date))
  const coverage =
    days.length === 1 ? `A freeze covered ${days[0]}` : `Freezes covered ${joinWithAnd(days)}`
  return `❄️ ${coverage}. ${currentStreak}-day streak safe.`
}

export const formatBreakMessage = (endedRun: number, best: number): string =>
  `Your ${endedRun}-day run ended. Best ${best} is kept.`

/** Whole hours left, or minutes in the last hour, never below one minute. */
export const formatTimeLeft = (closesAtMs: number, nowMs: number): string => {
  const minutes = Math.max(1, Math.ceil((closesAtMs - nowMs) / MS_PER_MINUTE))
  return minutes >= MINUTES_PER_HOUR
    ? `${Math.floor(minutes / MINUTES_PER_HOUR)} h left`
    : `${minutes} min left`
}

export const formatStillCounts = (number: number, closesAtMs: number, nowMs: number): string =>
  `#${number} still counts for your streak · ${formatTimeLeft(closesAtMs, nowMs)}`

/**
 * The one streak line on the result screen: the freeze message on the solve
 * that spent a freeze, else the break copy, else the best streak.
 */
export const streakNote = (data: StreakData): string => {
  if (data.rule !== 'puzzle') return ''
  if (data.covered && data.covered.length > 0) {
    return formatFreezeMessage(data.covered, data.currentStreak)
  }
  if (data.endedRun && data.endedRun > 0) {
    return formatBreakMessage(data.endedRun, data.longestStreak)
  }
  return data.longestStreak > 0 ? `Best streak ${data.longestStreak}` : ''
}
