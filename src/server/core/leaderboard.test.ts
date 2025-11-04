import { describe, expect, it } from 'vitest'
import { calculateCompositeScore } from './leaderboard'

describe('calculateCompositeScore', () => {
  it('should correctly calculate the composite score', () => {
    const rawScore = 100
    const achievedAt = 1672531200 // 2023-01-01 00:00:00 UTC
    const expectedScore = 100 * 1_000_000_000 - achievedAt
    expect(calculateCompositeScore(rawScore, achievedAt)).toBe(expectedScore)
  })

  it('should handle tie-breaking correctly', () => {
    const score1 = calculateCompositeScore(100, 1672531200) // Earlier time
    const score2 = calculateCompositeScore(100, 1672531201) // Later time
    expect(score1).toBeGreaterThan(score2)
  })

  it('should prioritize higher raw scores', () => {
    const score1 = calculateCompositeScore(101, 1672531200) // Higher score
    const score2 = calculateCompositeScore(100, 1672531100) // Lower score, earlier time
    expect(score1).toBeGreaterThan(score2)
  })
})
