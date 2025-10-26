import type { FixedCell, Grid } from './types/puzzle'
import { validateGrid } from './validator'

const cloneGrid = (grid: Grid): Grid => grid.map((row) => row.slice())

const findNextEmpty = (grid: Grid): { r: number; c: number } | null => {
	for (let r = 0; r < grid.length; r++) {
		const row = grid[r]
		if (!Array.isArray(row)) {
			continue
		}
		for (let c = 0; c < row.length; c++) {
			const cell = row[c]
			if (cell === null) {
				return { r, c }
			}
		}
	}
	return null
}

const solveFrom = (grid: Grid, fixed: FixedCell[]): boolean => {
	const spot = findNextEmpty(grid)
	if (!spot) {
		return validateGrid(grid, fixed).ok
	}
	const { r, c } = spot
	const row = grid[r]
	if (!Array.isArray(row) || c < 0 || c >= row.length) {
		return false
	}
	for (const value of [0, 1] as const) {
		row[c] = value
		if (!validateGrid(grid, fixed).ok) {
			row[c] = null
			continue
		}
		if (solveFrom(grid, fixed)) {
			return true
		}
		row[c] = null
	}
	return false
}

export const solvePuzzle = (initial: Grid, fixed: FixedCell[]): Grid | null => {
	const grid = cloneGrid(initial)
	if (!validateGrid(grid, fixed).ok) {
		return null
	}
	if (!solveFrom(grid, fixed)) {
		return null
	}
	return cloneGrid(grid)
}
