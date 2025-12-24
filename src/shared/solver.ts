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

const checkTripleRunInColumn = (
  grid: Grid,
  c: number,
  r: number,
  val: 0 | 1
): boolean => {
  // Check window of 3 cells centered around r
  const start = Math.max(0, r - 2)
  const end = Math.min(SIZE - TRIPLE_RUN_LENGTH, r)

  for (let i = start; i <= end; i++) {
    const a = i === r ? val : grid[i]?.[c]
    const b = i + 1 === r ? val : grid[i + 1]?.[c]
    const cv = i + 2 === r ? val : grid[i + 2]?.[c]
    if (a !== null && a !== undefined && a === b && b === cv) {
      return true
    }
  }
  return false
}

const solveFrom = (
  grid: Grid,
  fixed: FixedCell[],
  rowZeros: Int8Array,
  rowOnes: Int8Array,
  colZeros: Int8Array,
  colOnes: Int8Array
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
    // Check constraints incrementally

    // 1. Row counts
    if (value === 0 && rowZeros[r] >= MAX_COUNT_PER_LINE) continue
    if (value === 1 && rowOnes[r] >= MAX_COUNT_PER_LINE) continue

    // 2. Col counts
    if (value === 0 && colZeros[c] >= MAX_COUNT_PER_LINE) continue
    if (value === 1 && colOnes[c] >= MAX_COUNT_PER_LINE) continue

    // 3. Row triple run
    if (wouldCreateTripleRun(row as Cell[], c, value)) continue

    // 4. Col triple run
    if (checkTripleRunInColumn(grid, c, r, value)) continue

    // Place value
    row[c] = value
    if (value === 0) {
      rowZeros[r]++
      colZeros[c]++
    } else {
      rowOnes[r]++
      colOnes[c]++
    }

    if (solveFrom(grid, fixed, rowZeros, rowOnes, colZeros, colOnes)) {
      return true
    }

    // Backtrack
    row[c] = null
    if (value === 0) {
      rowZeros[r]--
      colZeros[c]--
    } else {
      rowOnes[r]--
      colOnes[c]--
    }
  }
  return false
}

export const solvePuzzle = (initial: Grid, fixed: FixedCell[]): Grid | null => {
  const grid = cloneGrid(initial)
  if (!validateGrid(grid, fixed).ok) {
    return null
  }

  // Initialize counts
  const rowZeros = new Int8Array(SIZE)
  const rowOnes = new Int8Array(SIZE)
  const colZeros = new Int8Array(SIZE)
  const colOnes = new Int8Array(SIZE)

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r]?.[c]
      if (cell === 0) {
        rowZeros[r]++
        colZeros[c]++
      } else if (cell === 1) {
        rowOnes[r]++
        colOnes[c]++
      }
    }
  }

  if (
    !solveFrom(grid, fixed, rowZeros, rowOnes, colZeros, colOnes)
  ) {
    return null
  }
  return cloneGrid(grid)
}
