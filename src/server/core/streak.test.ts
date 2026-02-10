import { describe, expect, it } from 'vitest'
import { computeStreakUpdate } from './streak'

describe('computeStreakUpdate', () => {
  it('starts a new streak when there is no previous date', () => {
    const result = computeStreakUpdate(
      { lastSolvedDate: null, currentStreak: 0, bestStreak: 0 },
      '2026-02-05'
    )

    expect(result.streak).toBe(1)
    expect(result.bestStreak).toBe(1)
    expect(result.isNewDay).toBe(true)
    expect(result.nextState.lastSolvedDate).toBe('2026-02-05')
  })

  it('continues a streak on consecutive UTC days', () => {
    const result = computeStreakUpdate(
      { lastSolvedDate: '2026-02-04', currentStreak: 2, bestStreak: 3 },
      '2026-02-05'
    )

    expect(result.streak).toBe(3)
    expect(result.bestStreak).toBe(3)
    expect(result.isNewDay).toBe(true)
  })

  it('resets streak when days are skipped', () => {
    const result = computeStreakUpdate(
      { lastSolvedDate: '2026-02-01', currentStreak: 4, bestStreak: 6 },
      '2026-02-05'
    )

    expect(result.streak).toBe(1)
    expect(result.bestStreak).toBe(6)
  })

  it('does not change streak when solved multiple times in one day', () => {
    const result = computeStreakUpdate(
      { lastSolvedDate: '2026-02-05', currentStreak: 3, bestStreak: 3 },
      '2026-02-05'
    )

    expect(result.streak).toBe(3)
    expect(result.bestStreak).toBe(3)
    expect(result.isNewDay).toBe(false)
  })
})
