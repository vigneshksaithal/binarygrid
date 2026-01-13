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
  val: 0 | 1,
  colBuffer: Cell[]
): boolean => {
  const row = grid[r]
  if (!Array.isArray(row) || row.length !== SIZE) {
    return false
  }

  // Check row constraints
  let rowZeros = 0
  let rowOnes = 0
  const rowLen = row.length
  for (let i = 0; i < rowLen; i++) {
    const v = row[i]
    if (v === 0) rowZeros++
    else if (v === 1) rowOnes++
  }

  if (val === 0 && rowZeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && rowOnes >= MAX_COUNT_PER_LINE) {
    return false
  }

  // Populate column buffer and count constraints in one pass
  let colZeros = 0
  let colOnes = 0
  for (let i = 0; i < SIZE; i++) {
    const v = (grid[i]?.[c] ?? null) as Cell
    colBuffer[i] = v
    if (v === 0) colZeros++
    else if (v === 1) colOnes++
  }

  if (val === 0 && colZeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && colOnes >= MAX_COUNT_PER_LINE) {
    return false
  }

  // Check triple run in row
  if (wouldCreateTripleRun(row as Cell[], c, val)) {
    return false
  }

  // Check triple run in column
  if (wouldCreateTripleRun(colBuffer, r, val)) {
    return false
  }

  return true
}

const solveFrom = (
  grid: Grid,
  fixed: FixedCell[],
  colBuffer: Cell[]
): boolean => {
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
    if (!canPlaceValue(grid, r, c, value, colBuffer)) {
      continue
    }
    row[c] = value
    if (solveFrom(grid, fixed, colBuffer)) {
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
  // Allocate buffer once and reuse
  const colBuffer = new Array(SIZE)
  if (!solveFrom(grid, fixed, colBuffer)) {
    return null
  }
  return cloneGrid(grid)
}
