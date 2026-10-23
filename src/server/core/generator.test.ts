import { afterEach, describe, expect, it, vi } from 'vitest'
import { DAILY_DIFFICULTIES } from '../../shared/growth'
import { solvePuzzle } from '../../shared/solver'
import { isComplete, validateGrid } from '../../shared/validator'
import { generateDailyPuzzle, generatePuzzleForDate, generatePuzzleForPost, getClueTarget } from './generator'

const NEXT_DATE = '2026-10-23'
const MORNING = new Date('2026-10-22T08:00:00.000Z')
const EVENING = new Date('2026-10-22T20:00:00.000Z')

afterEach(() => {
  vi.useRealTimers()
})

describe('generator', () => {
  it('is deterministic by date+difficulty', () => {
    const a = generateDailyPuzzle('2025-09-29', 'medium')
    const b = generateDailyPuzzle('2025-09-29', 'medium')
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })

  it('produces unique solvable puzzle meeting rules', () => {
    const p = generateDailyPuzzle('2025-09-29', 'easy')
    const res = validateGrid(p.initial, p.fixed)
    expect(res.ok).toBe(true)
    // Not necessarily complete; ensure fixed respected and no early violations
    expect(isComplete(p.initial)).toBe(false)
  })

  it('gives a post puzzle its post-scoped ID', () => {
    expect(generatePuzzleForPost('t3_abc', 'medium').id).toBe('t3_abc:medium')
  })

  it('generates a solvable puzzle for a date ahead, with no ID, for every tier', () => {
    for (const difficulty of DAILY_DIFFICULTIES) {
      const puzzle = generatePuzzleForDate(NEXT_DATE, difficulty)

      expect(puzzle).not.toHaveProperty('id')
      expect(puzzle.difficulty).toBe(difficulty)
      expect(puzzle.fixed.length).toBeGreaterThanOrEqual(getClueTarget(difficulty))
      expect(validateGrid(puzzle.initial, puzzle.fixed).ok).toBe(true)
      expect(solvePuzzle(puzzle.initial, puzzle.fixed)).not.toBeNull()
    }
  })

  it('seeds a date puzzle with the time, so the date alone does not give it away', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MORNING)
    const generatedInTheMorning = generatePuzzleForDate(NEXT_DATE, 'hard')
    vi.setSystemTime(EVENING)
    const generatedInTheEvening = generatePuzzleForDate(NEXT_DATE, 'hard')

    expect(generatedInTheEvening.initial).not.toEqual(generatedInTheMorning.initial)
    expect(generatedInTheMorning.initial).not.toEqual(generateDailyPuzzle(NEXT_DATE, 'hard').initial)
  })
})
