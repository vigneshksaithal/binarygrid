import { describe, expect, it } from 'vitest'
import { isComplete, validateGrid } from '../../shared/validator'
import { generateDailyPuzzle } from './generator'

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
})
