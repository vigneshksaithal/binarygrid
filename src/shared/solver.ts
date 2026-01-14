import { SIZE } from './rules'
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

const MAX_COUNT_PER_LINE = 3
const TRIPLE_RUN_LENGTH = 3

/**
 * Validates if placing a value at (r, c) would violate constraints.
 * This is a lightweight check that avoids full grid validation.
 * Optimized to avoid allocations in the hot path.
 */
const canPlaceValue = (
  grid: Grid,
  r: number,
  c: number,
  val: 0 | 1
): boolean => {
  const row = grid[r]
  // We assume grid is well-formed inside solver for perf
  // if (!Array.isArray(row) || row.length !== SIZE) return false

  // --- Row Checks ---
  // Count: iterate row once
  let r0 = 0
  let r1 = 0
  // Inlining iteration for row counts
  // We use non-null assertion or optional chaining if TS complains,
  // but logically row exists if we passed bounds check (implied).
  if (row) {
    for (const v of row) {
      if (v === 0) r0++
      else if (v === 1) r1++
    }
  }
  if (val === 0) {
    if (r0 >= MAX_COUNT_PER_LINE) return false
  } else {
    if (r1 >= MAX_COUNT_PER_LINE) return false
  }

  // Triple Run: check window around c
  const rStart = Math.max(0, c - 2)
  const rEnd = Math.min(SIZE - TRIPLE_RUN_LENGTH, c)

  if (row) {
    for (let k = rStart; k <= rEnd; k++) {
      // Manually get values for k, k+1, k+2, replacing index c with val
      const v1 = k === c ? val : row[k]
      const v2 = k + 1 === c ? val : row[k + 1]
      const v3 = k + 2 === c ? val : row[k + 2]

      // We only care if they are all equal. v1, v2, v3 are Cell (0|1|null).
      // The strict equality a===b===c checks values.
      // If any is null, it's not a run.
      if (v1 !== null && v1 === v2 && v2 === v3) {
        return false
      }
    }
  }

  // --- Column Checks ---
  // Count: iterate column once, accessing grid directly to avoid allocating col array
  let c0 = 0
  let c1 = 0
  for (let i = 0; i < SIZE; i++) {
    // grid[i] is row i. grid[i][c] is cell.
    const v = grid[i]?.[c]
    if (v === 0) c0++
    else if (v === 1) c1++
  }
  if (val === 0) {
    if (c0 >= MAX_COUNT_PER_LINE) return false
  } else {
    if (c1 >= MAX_COUNT_PER_LINE) return false
  }

  // Triple Run: check window around r
  const cStart = Math.max(0, r - 2)
  const cEnd = Math.min(SIZE - TRIPLE_RUN_LENGTH, r)

  for (let k = cStart; k <= cEnd; k++) {
    const v1 = k === r ? val : grid[k]?.[c]
    const v2 = k + 1 === r ? val : grid[k + 1]?.[c]
    const v3 = k + 2 === r ? val : grid[k + 2]?.[c]

    if (v1 !== null && v1 === v2 && v2 === v3) {
      return false
    }
  }

  return true
}

const solveFrom = (grid: Grid, fixed: FixedCell[]): boolean => {
  const spot = findNextEmpty(grid)
  if (!spot) {
    // All cells filled - do a final validation
    return validateGrid(grid, fixed).ok
  }
  const { r, c } = spot
  const row = grid[r]
  if (!Array.isArray(row) || c < 0 || c >= row.length) {
    return false
  }
  for (const value of [0, 1] as const) {
    // Use lightweight constraint check instead of full validation
    if (!canPlaceValue(grid, r, c, value)) {
      continue
    }
    row[c] = value
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
