import { SIZE } from './rules'
import type { Cell, FixedCell, Grid } from './types/puzzle'
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
 * Counts zeros and ones in a line.
 * Keeping this for potential external usage if needed, but not used in hot path anymore.
 */
const countLine = (line: Cell[]): { zeros: number; ones: number } => {
  let zeros = 0
  let ones = 0
  for (const v of line) {
    if (v === 0) {
      zeros++
    } else if (v === 1) {
      ones++
    }
  }
  return { zeros, ones }
}

/**
 * Checks if a row already has the maximum allowed count for a specific value.
 * Returns true if the count constraint is violated.
 * Optimized: exits early as soon as the limit is reached.
 */
const hasMaxCountRow = (row: Cell[], val: 0 | 1): boolean => {
  let count = 0
  for (let i = 0; i < SIZE; i++) {
    if (row[i] === val) {
      count++
      if (count >= MAX_COUNT_PER_LINE) return true
    }
  }
  return false
}

/**
 * Checks if a column already has the maximum allowed count for a specific value.
 * Returns true if the count constraint is violated.
 * Optimized: direct grid access (no allocation) and exits early.
 */
const hasMaxCountCol = (grid: Grid, c: number, val: 0 | 1): boolean => {
  let count = 0
  for (let r = 0; r < SIZE; r++) {
    if (grid[r]?.[c] === val) {
      count++
      if (count >= MAX_COUNT_PER_LINE) return true
    }
  }
  return false
}

/**
 * Checks if placing a value at the given position would create a triple run.
 * Optimized: only checks around the affected position.
 */
const wouldCreateTripleRun = (
  line: Cell[],
  idx: number,
  val: 0 | 1
): boolean => {
  // Check window of 3 cells centered around idx
  const start = Math.max(0, idx - 2)
  const end = Math.min(line.length - TRIPLE_RUN_LENGTH, idx)

  for (let i = start; i <= end; i++) {
    const a = i === idx ? val : line[i]
    const b = i + 1 === idx ? val : line[i + 1]
    const c = i + 2 === idx ? val : line[i + 2]
    if (a !== null && a === b && b === c) {
      return true
    }
  }
  return false
}

/**
 * Checks if placing a value at the given position would create a triple run in a column.
 * Optimized: direct grid access, no array allocation.
 */
const wouldCreateTripleRunCol = (
  grid: Grid,
  r: number,
  c: number,
  val: 0 | 1
): boolean => {
  // Check window of 3 cells centered around r
  const start = Math.max(0, r - 2)
  const end = Math.min(SIZE - TRIPLE_RUN_LENGTH, r)

  for (let i = start; i <= end; i++) {
    // Get values directly from grid, using `val` for the target cell
    const v1 = i === r ? val : (grid[i]?.[c] ?? null)
    const v2 = i + 1 === r ? val : (grid[i + 1]?.[c] ?? null)
    const v3 = i + 2 === r ? val : (grid[i + 2]?.[c] ?? null)

    if (v1 !== null && v1 === v2 && v2 === v3) {
      return true
    }
  }
  return false
}

/**
 * Validates if placing a value at (r, c) would violate constraints.
 * This is a lightweight check that avoids full grid validation.
 */
const canPlaceValue = (
  grid: Grid,
  r: number,
  c: number,
  val: 0 | 1
): boolean => {
  const row = grid[r]
  if (!Array.isArray(row) || row.length !== SIZE) {
    return false
  }

  // Check row constraints (fail-fast)
  if (hasMaxCountRow(row as Cell[], val)) {
    return false
  }

  // Check column constraints (allocation-free, fail-fast)
  if (hasMaxCountCol(grid, c, val)) {
    return false
  }

  // Check triple run in row
  if (wouldCreateTripleRun(row as Cell[], c, val)) {
    return false
  }

  // Check triple run in column (allocation-free)
  if (wouldCreateTripleRunCol(grid, r, c, val)) {
    return false
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
