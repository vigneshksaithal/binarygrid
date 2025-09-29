import { describe, expect, it } from 'vitest'
import { SIZE } from './rules'
import type { Cell, FixedCell, Grid } from './types/puzzle'
import { isComplete, validateGrid } from './validator'

const empty = (): Grid =>
	Array.from({ length: SIZE }, () =>
		Array.from({ length: SIZE }, () => null as Cell)
	)

describe('validator', () => {
	it('rejects wrong shape', () => {
		const g = empty().slice(0, 5)
		const res = validateGrid(g as unknown as Grid, [])
		expect(res.ok).toBe(false)
	})

	it('accepts a valid solved grid', () => {
		// Balanced 6x6 matching rules (manually crafted)
		const g: Grid = [
			[0, 0, 1, 1, 0, 1],
			[1, 1, 0, 0, 1, 0],
			[0, 1, 0, 1, 0, 1],
			[1, 0, 1, 0, 1, 0],
			[0, 1, 1, 0, 0, 1],
			[1, 0, 0, 1, 1, 0]
		]
		const res = validateGrid(g, [])
		expect(res.ok).toBe(true)
		expect(isComplete(g)).toBe(true)
	})

	it('rejects triple run in row', () => {
		const g = empty()
		g[0] = [1, 1, 1, null, null, null]
		const res = validateGrid(g, [])
		expect(res.ok).toBe(false)
	})

	it('respects fixed cells', () => {
		const g = empty()
		g[2][2] = 0
		const fixed: FixedCell[] = [{ r: 2, c: 2, v: 1 }]
		const res = validateGrid(g, fixed)
		expect(res.ok).toBe(false)
	})
})
