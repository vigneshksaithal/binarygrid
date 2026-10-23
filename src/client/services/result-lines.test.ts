import { describe, expect, it } from 'vitest'
import { SOLVE_QUALITY_DEFINITIONS } from '../../shared/growth'
import type { DailyProgress, PlayerContext } from '../stores/growth'
import {
  DEFINITION_RESERVES,
  FASTER_LINE_RESERVES,
  formatFasterLine,
  formatProgressLine,
  PROGRESS_LINE_RESERVES,
} from './result-lines'

const MAX_PERCENTILE = 100
const LARGEST_COVERED_GAP_SECONDS = 9999
const MAX_FREEZES = 2
const TIER_COUNT = 3

const longest = (reserves: readonly string[]): number =>
  Math.max(...reserves.map((reserve) => reserve.length))

const playerContext = (
  fasterThanPercentile: number,
  nextRankSeconds: number | null
): PlayerContext => ({
  rank: 3,
  totalEntries: 41,
  fasterThanPercentile,
  nextRankSeconds,
  topTenCutoffSeconds: 80,
  bestDifficultyToday: 'easy',
  completedDifficulties: ['easy'],
})

const dailyProgress = (
  completedCount: number,
  badge: 'none' | 'trio' | 'perfect',
  freezes: number
): DailyProgress => ({
  dateISO: '2026-10-23',
  completedDifficulties: [],
  trio: {
    completedDifficulties: [],
    completedCount,
    trioComplete: badge !== 'none',
    perfectDay: badge === 'perfect',
    totalSolveTimeSeconds: 0,
  },
  streak: { currentStreak: 4, longestStreak: 9, freezes, todayCompleted: true, repairAvailable: false },
  missions: [],
})

describe('formatFasterLine', () => {
  it('says how many solvers this time beat and the gap to the next rank', () => {
    expect(formatFasterLine(playerContext(93, 12))).toBe('Faster than 93% today · 12s from next rank')
  })

  it('leaves the gap out at the top of the board', () => {
    expect(formatFasterLine(playerContext(100, null))).toBe('Faster than 100% today')
  })

  it('is empty until the rank is known', () => {
    expect(formatFasterLine(null)).toBeNull()
  })
})

describe('formatProgressLine', () => {
  it("counts today's tiers", () => {
    expect(formatProgressLine(dailyProgress(0, 'none', 0))).toBe('0/3 difficulties today')
  })

  it('adds the trio badge, Perfect Day first, and the freezes left', () => {
    expect(formatProgressLine(dailyProgress(3, 'trio', 1))).toBe(
      '3/3 difficulties today · Trio Complete · 1 freeze'
    )
    expect(formatProgressLine(dailyProgress(3, 'perfect', 2))).toBe(
      '3/3 difficulties today · Perfect Day · 2 freezes'
    )
  })

  it("is empty until today's progress is known", () => {
    expect(formatProgressLine(null)).toBeNull()
  })
})

describe('the room each late line holds', () => {
  it('covers every solve-label definition', () => {
    expect([...DEFINITION_RESERVES].sort()).toEqual(Object.values(SOLVE_QUALITY_DEFINITIONS).sort())
  })

  it('covers every percentile with any gap under 10,000 s', () => {
    for (let percentile = 0; percentile <= MAX_PERCENTILE; percentile += 1) {
      for (const gap of [null, 0, 9, 99, 999, LARGEST_COVERED_GAP_SECONDS]) {
        const line = formatFasterLine(playerContext(percentile, gap)) ?? ''
        expect(line.length).toBeLessThanOrEqual(longest(FASTER_LINE_RESERVES))
      }
    }
  })

  it('covers every tier count, badge and freeze balance', () => {
    for (let count = 0; count <= TIER_COUNT; count += 1) {
      for (const badge of ['none', 'trio', 'perfect'] as const) {
        for (let freezes = 0; freezes <= MAX_FREEZES; freezes += 1) {
          const line = formatProgressLine(dailyProgress(count, badge, freezes)) ?? ''
          expect(line.length).toBeLessThanOrEqual(longest(PROGRESS_LINE_RESERVES))
        }
      }
    }
  })
})
