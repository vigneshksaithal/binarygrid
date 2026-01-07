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

// Optimization: Reusable array to avoid allocation in hot path.
// This is safe because solvePuzzle is synchronous and single-threaded.
const reusableCol: Cell[] = new Array(SIZE)

/**
 * Counts zeros and ones in a line.
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

  // Check row constraints
  const rowCounts = countLine(row as Cell[])
  if (val === 0 && rowCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && rowCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }

  // Build column and check constraints
  // Use reusableCol instead of new Array(SIZE)
  for (let i = 0; i < SIZE; i++) {
    reusableCol[i] = grid[i][c]
  }
  const colCounts = countLine(reusableCol)
  if (val === 0 && colCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && colCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }

  // Check triple run in row
  if (wouldCreateTripleRun(row as Cell[], c, val)) {
    return false
  }

  // Check triple run in column
  if (wouldCreateTripleRun(reusableCol, r, val)) {
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
