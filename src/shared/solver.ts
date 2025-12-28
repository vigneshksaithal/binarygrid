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
 * Counts zeros and ones in a row.
 */
const countRow = (row: Cell[]): { zeros: number; ones: number } => {
  let zeros = 0
  let ones = 0
  for (const v of row) {
    if (v === 0) {
      zeros++
    } else if (v === 1) {
      ones++
    }
  }
  return { zeros, ones }
}

/**
 * Counts zeros and ones in a column by accessing the grid directly.
 * Optimized to avoid allocating a column array.
 */
const countCol = (grid: Grid, colIdx: number): { zeros: number; ones: number } => {
  let zeros = 0
  let ones = 0
  for (let r = 0; r < SIZE; r++) {
    const v = grid[r]?.[colIdx] ?? null
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
const wouldCreateTripleRunRow = (
  row: Cell[],
  c: number,
  val: 0 | 1
): boolean => {
  const start = Math.max(0, c - 2)
  const end = Math.min(row.length - TRIPLE_RUN_LENGTH, c)

  for (let i = start; i <= end; i++) {
    const v1 = i === c ? val : row[i]
    const v2 = i + 1 === c ? val : row[i + 1]
    const v3 = i + 2 === c ? val : row[i + 2]
    if (v1 !== null && v1 === v2 && v2 === v3) {
      return true
    }
  }
  return false
}

/**
 * Checks if placing a value at the given position would create a triple run in the column.
 * Optimized: accesses grid directly to avoid array allocation.
 */
const wouldCreateTripleRunCol = (
  grid: Grid,
  r: number,
  c: number,
  val: 0 | 1
): boolean => {
  const start = Math.max(0, r - 2)
  const end = Math.min(SIZE - TRIPLE_RUN_LENGTH, r)

  for (let i = start; i <= end; i++) {
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

  // Check row constraints
  const rowCounts = countRow(row as Cell[])
  if (val === 0 && rowCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && rowCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }

  // Check column constraints without allocating array
  // We can fail fast if we count more than MAX
  const colCounts = countCol(grid, c)
  if (val === 0 && colCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && colCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }

  // Check triple run in row
  if (wouldCreateTripleRunRow(row as Cell[], c, val)) {
    return false
  }

  // Check triple run in column
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
