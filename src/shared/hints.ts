import { EXACT_ONES_PER_LINE, EXACT_ZEROS_PER_LINE, SIZE } from './rules'
import type { Cell, FixedCell, Grid } from './types/puzzle'

type CandidateValue = 0 | 1

type ForcedMove = {
  r: number
  c: number
  value: CandidateValue
}

const isFixed = (fixedSet: Set<string>, r: number, c: number): boolean =>
  fixedSet.has(`${r},${c}`)

const countLine = (line: Cell[]): { zeros: number; ones: number } => {
  let zeros = 0
  let ones = 0
  for (const value of line) {
    if (value === 0) zeros++
    if (value === 1) ones++
  }
  return { zeros, ones }
}

const wouldCreateTripleRun = (
  line: Cell[],
  idx: number,
  value: CandidateValue
): boolean => {
  const start = Math.max(0, idx - 2)
  const end = Math.min(line.length - 3, idx)

  for (let i = start; i <= end; i++) {
    const a = i === idx ? value : line[i]
    const b = i + 1 === idx ? value : line[i + 1]
    const c = i + 2 === idx ? value : line[i + 2]
    if (a !== null && a === b && b === c) {
      return true
    }
  }

  return false
}

export const getCellCandidates = (
  grid: Grid,
  r: number,
  c: number,
  fixed: FixedCell[]
): CandidateValue[] => {
  const row = grid[r]
  if (!Array.isArray(row) || row.length !== SIZE) {
    return []
  }
  if (row[c] !== null) {
    return []
  }

  const fixedSet = new Set(fixed.map((cell) => `${cell.r},${cell.c}`))
  if (isFixed(fixedSet, r, c)) {
    return []
  }

  const rowCounts = countLine(row as Cell[])
  const column: Cell[] = new Array(SIZE)
  for (let i = 0; i < SIZE; i++) {
    const value = grid[i]?.[c]
    column[i] = value === 0 || value === 1 ? value : null
  }
  const colCounts = countLine(column)

  const candidates: CandidateValue[] = []

  for (const value of [0, 1] as const) {
    if (value === 0 && rowCounts.zeros >= EXACT_ZEROS_PER_LINE) {
      continue
    }
    if (value === 1 && rowCounts.ones >= EXACT_ONES_PER_LINE) {
      continue
    }
    if (value === 0 && colCounts.zeros >= EXACT_ZEROS_PER_LINE) {
      continue
    }
    if (value === 1 && colCounts.ones >= EXACT_ONES_PER_LINE) {
      continue
    }
    if (wouldCreateTripleRun(row as Cell[], c, value)) {
      continue
    }
    if (wouldCreateTripleRun(column, r, value)) {
      continue
    }
    candidates.push(value)
  }

  return candidates
}

export const findForcedMoves = (grid: Grid, fixed: FixedCell[]): ForcedMove[] => {
  const fixedSet = new Set(fixed.map((cell) => `${cell.r},${cell.c}`))
  const forcedMoves: ForcedMove[] = []

  for (let r = 0; r < SIZE; r++) {
    const row = grid[r]
    if (!Array.isArray(row) || row.length !== SIZE) {
      continue
    }
    for (let c = 0; c < SIZE; c++) {
      if (row[c] !== null) {
        continue
      }
      if (isFixed(fixedSet, r, c)) {
        continue
      }
      const candidates = getCellCandidates(grid, r, c, fixed)
      if (candidates.length === 1) {
        const value = candidates[0] as CandidateValue
        forcedMoves.push({ r, c, value })
      }
    }
  }

  return forcedMoves
}

export type { ForcedMove }
