import { describe, expect, it } from 'vitest'
import {
  formatBreakMessage,
  formatFreezeMessage,
  formatStillCounts,
  formatTimeLeft,
  streakNote,
} from './streak-copy'
import type { StreakData } from './types/streak'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const NOW_MS = Date.parse('2026-10-22T09:00:00Z')

const puzzleStreak = (overrides: Partial<StreakData> = {}): StreakData => ({
  currentStreak: 24,
  longestStreak: 30,
  todayCompleted: true,
  rule: 'puzzle',
  freezes: 1,
  endedRun: 0,
  covered: [],
  stillCounts: null,
  ...overrides,
})

describe('formatFreezeMessage', () => {
  it('names the weekday a freeze covered', () => {
    expect(formatFreezeMessage([{ number: 126, date: '2026-10-20' }], 24)).toBe(
      '❄️ A freeze covered Tuesday. 24-day streak safe.'
    )
  })

  it('names both days, oldest first, when two freezes were spent', () => {
    const covered = [
      { number: 127, date: '2026-10-21' },
      { number: 126, date: '2026-10-20' },
    ]

    expect(formatFreezeMessage(covered, 24)).toBe(
      '❄️ Freezes covered Tuesday and Wednesday. 24-day streak safe.'
    )
  })
})

describe('formatBreakMessage', () => {
  it('says the run ended and keeps the best, without blame', () => {
    expect(formatBreakMessage(23, 23)).toBe('Your 23-day run ended. Best 23 is kept.')
  })
})

describe('formatTimeLeft', () => {
  it.each([
    [11 * HOUR_MS + 20 * MINUTE_MS, '11 h left'],
    [HOUR_MS, '1 h left'],
    [45 * MINUTE_MS, '45 min left'],
    [20 * 1000, '1 min left'],
  ])('shows %i ms as "%s"', (remainingMs, text) => {
    expect(formatTimeLeft(NOW_MS + remainingMs, NOW_MS)).toBe(text)
  })
})

describe('formatStillCounts', () => {
  it('names the number and the time left on its window', () => {
    expect(formatStillCounts(127, NOW_MS + 11 * HOUR_MS, NOW_MS)).toBe(
      '#127 still counts for your streak · 11 h left'
    )
  })
})

describe('streakNote', () => {
  it('shows the freeze message on the solve that spent a freeze', () => {
    const covered = [{ number: 126, date: '2026-10-20' }]

    expect(streakNote(puzzleStreak({ covered }))).toBe(
      '❄️ A freeze covered Tuesday. 24-day streak safe.'
    )
  })

  it('shows the break copy when the last run ended', () => {
    expect(streakNote(puzzleStreak({ currentStreak: 1, longestStreak: 23, endedRun: 23 }))).toBe(
      'Your 23-day run ended. Best 23 is kept.'
    )
  })

  it('shows the best streak otherwise', () => {
    expect(streakNote(puzzleStreak())).toBe('Best streak 30')
  })

  it('shows nothing before a first streak', () => {
    expect(streakNote(puzzleStreak({ currentStreak: 0, longestStreak: 0 }))).toBe('')
  })

  it('shows nothing under the calendar rule, as today', () => {
    expect(streakNote({ currentStreak: 4, longestStreak: 9, todayCompleted: true })).toBe('')
  })
})
