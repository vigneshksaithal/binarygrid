import { describe, expect, it } from 'vitest'
import {
  calculateFasterThanPercentile,
  calculateWeeklyLeaguePoints,
  deriveSolveQuality,
  getDailyMissions,
  getDailyTrioSummary,
  getWeeklyLeagueId,
  updateStreakFreezeBalance,
} from './growth'

describe('deriveSolveQuality', () => {
  it('labels a solve with no help or corrections as clean', () => {
    expect(deriveSolveQuality({ hintsUsed: 0, mistakeCount: 0, undoCount: 0 })).toBe('clean')
  })

  it('labels a solve with undos but no mistakes or hints as sharp', () => {
    expect(deriveSolveQuality({ hintsUsed: 0, mistakeCount: 0, undoCount: 2 })).toBe('sharp')
  })

  it('labels a solve with mistakes but no hints as comeback', () => {
    expect(deriveSolveQuality({ hintsUsed: 0, mistakeCount: 1, undoCount: 0 })).toBe('comeback')
  })

  it('labels any solve with hints as assisted', () => {
    expect(deriveSolveQuality({ hintsUsed: 1, mistakeCount: 0, undoCount: 0 })).toBe('assisted')
  })
})

describe('calculateFasterThanPercentile', () => {
  it('returns how much of the field the player beat', () => {
    expect(calculateFasterThanPercentile(18, 100)).toBe(82)
  })

  it('handles a single-player leaderboard as a complete win', () => {
    expect(calculateFasterThanPercentile(1, 1)).toBe(100)
  })

  it('returns zero for invalid rank data', () => {
    expect(calculateFasterThanPercentile(null, 0)).toBe(0)
  })
})

describe('getDailyTrioSummary', () => {
  it('counts completed difficulties and marks perfect day only when all three are clean', () => {
    const summary = getDailyTrioSummary({
      easy: { solveTimeSeconds: 48, solveQuality: 'clean' },
      medium: { solveTimeSeconds: 132, solveQuality: 'sharp' },
      hard: { solveTimeSeconds: 230, solveQuality: 'clean' },
    })

    expect(summary.completedCount).toBe(3)
    expect(summary.trioComplete).toBe(true)
    expect(summary.perfectDay).toBe(false)
    expect(summary.totalSolveTimeSeconds).toBe(410)
  })
})

describe('getDailyMissions', () => {
  it('returns a deterministic mission set for a UTC date', () => {
    expect(getDailyMissions('2026-05-15')).toEqual(getDailyMissions('2026-05-15'))
  })

  it('rotates the mission set by date', () => {
    const first = getDailyMissions('2026-05-15').map((mission) => mission.id)
    const second = getDailyMissions('2026-05-16').map((mission) => mission.id)

    expect(first).not.toEqual(second)
  })
})

describe('updateStreakFreezeBalance', () => {
  it('earns one freeze at five-day intervals and caps at two', () => {
    expect(updateStreakFreezeBalance({ currentStreak: 5, currentFreezes: 0 })).toEqual({
      freezes: 1,
      earnedFreeze: true,
    })
    expect(updateStreakFreezeBalance({ currentStreak: 10, currentFreezes: 2 })).toEqual({
      freezes: 2,
      earnedFreeze: false,
    })
  })
})

describe('weekly leagues', () => {
  it('assigns users to deterministic weekly league buckets', () => {
    expect(getWeeklyLeagueId('t2_user', '2026-W20')).toBe(
      getWeeklyLeagueId('t2_user', '2026-W20')
    )
  })

  it('awards more points for harder clean trio solves', () => {
    const cleanHard = calculateWeeklyLeaguePoints({
      difficulty: 'hard',
      solveQuality: 'clean',
      trioComplete: true,
    })
    const assistedEasy = calculateWeeklyLeaguePoints({
      difficulty: 'easy',
      solveQuality: 'assisted',
      trioComplete: false,
    })

    expect(cleanHard).toBeGreaterThan(assistedEasy)
  })
})
