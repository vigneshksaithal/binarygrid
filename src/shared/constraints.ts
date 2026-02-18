import { SIZE } from './rules'
import type { Cell, Grid } from './types/puzzle'
import { countLine } from './utils/grid'

const TRIPLE_RUN_LENGTH = 3
const MAX_COUNT_PER_LINE = 3

export const wouldCreateTripleRun = (
  line: Cell[],
  idx: number,
  val: 0 | 1
): boolean => {
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

export const canPlaceValue = (
  grid: Grid,
  r: number,
  c: number,
  val: 0 | 1,
  reusableCol?: Cell[]
): boolean => {
  const row = grid[r]
  if (!Array.isArray(row) || row.length !== SIZE) {
    return false
  }

  if (row[c] !== null) {
    return false
  }

  const rowCounts = countLine(row as Cell[])
  if (val === 0 && rowCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && rowCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }

  const col = reusableCol ?? new Array<Cell>(SIZE)
  for (let i = 0; i < SIZE; i++) {
    col[i] = (grid[i]?.[c] ?? null) as Cell
  }
  const colCounts = countLine(col)
  if (val === 0 && colCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && colCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }

  if (wouldCreateTripleRun(row as Cell[], c, val)) {
    return false
  }

  if (wouldCreateTripleRun(col, r, val)) {
    return false
  }

  return true
}
