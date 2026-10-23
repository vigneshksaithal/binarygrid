import { afterEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import type { DailyProgress } from './growth'
import { fetchStreak, parseStreakData, shownFreezes, shownStreak, streakStore } from './streak'

const calendarBody = {
  currentStreak: 5,
  longestStreak: 9,
  lastPlayedDate: '2026-10-21',
  todayCompleted: false,
}

const puzzleBody = {
  currentStreak: 7,
  longestStreak: 23,
  todayCompleted: true,
  rule: 'puzzle',
  freezes: 1,
  endedRun: 0,
  covered: [{ number: 126, date: '2026-10-20' }],
  stillCounts: { number: 127, postId: 't3_post127', closesAt: '2026-10-22T20:00:00.000Z' },
}

const progressWith = (currentStreak: number, freezes: number): DailyProgress => ({
  dateISO: '2026-10-22',
  completedDifficulties: [],
  trio: {
    completedDifficulties: [],
    completedCount: 0,
    trioComplete: false,
    perfectDay: false,
    totalSolveTimeSeconds: 0,
  },
  streak: { currentStreak, longestStreak: 9, freezes, todayCompleted: true, repairAvailable: false },
  missions: [],
})

describe('parseStreakData', () => {
  it("keeps the calendar rule's three fields, as the store did before", () => {
    expect(parseStreakData(calendarBody)).toEqual({
      currentStreak: 5,
      longestStreak: 9,
      todayCompleted: false,
    })
  })

  it("keeps the puzzle rule's freezes, ended run, covered numbers and pointer", () => {
    expect(parseStreakData(puzzleBody)).toEqual(puzzleBody)
  })

  it('drops malformed puzzle details', () => {
    expect(
      parseStreakData({ ...puzzleBody, covered: [{ number: '126' }], stillCounts: { number: 127 } })
    ).toMatchObject({ covered: [], stillCounts: null })
  })

  it('reads anything else as no streak', () => {
    expect(parseStreakData(null)).toEqual({ currentStreak: 0, longestStreak: 0, todayCompleted: false })
  })
})

describe('shownStreak and shownFreezes', () => {
  it("show the calendar rule's progress numbers first, as the result screen does today", () => {
    const data = parseStreakData(calendarBody)

    expect(shownStreak(data, progressWith(6, 2))).toBe(6)
    expect(shownFreezes(data, progressWith(6, 2))).toBe(2)
    expect(shownStreak(data, null)).toBe(5)
  })

  it('show the puzzle streak and its own freezes under the puzzle rule', () => {
    const data = parseStreakData(puzzleBody)

    expect(shownStreak(data, progressWith(6, 2))).toBe(7)
    expect(shownFreezes(data, progressWith(6, 2))).toBe(1)
  })
})

describe('fetchStreak', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores the parsed streak from /api/streak', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(puzzleBody))))

    await fetchStreak()

    expect(get(streakStore)).toEqual({ status: 'ready', data: puzzleBody })
  })
})
