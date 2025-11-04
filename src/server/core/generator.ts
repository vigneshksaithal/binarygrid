import { SIZE } from '../../shared/rules'
import type {
  Cell,
  Difficulty,
  Grid,
  PuzzleWithGrid
} from '../../shared/types/puzzle'
import { validateGrid } from '../../shared/validator'

/**
 * Returns a deterministic 6x6 null grid.
 */
const makeEmptyGrid = (): Grid => {
  const grid: Grid = new Array(SIZE)
  for (let r = 0; r < SIZE; r++) {
    const row = new Array(SIZE)
    for (let c = 0; c < SIZE; c++) {
      row[c] = null
    }
    grid[r] = row
  }
  return grid
}

const ensureRow = (g: Grid, r: number): Cell[] => {
  const row = g[r]
  if (!Array.isArray(row) || row.length !== SIZE) {
    throw new Error('grid shape invalid')
  }
  return row as Cell[]
}

// Constants for clue counts
const CLUE_COUNT_EASY = 17
const CLUE_COUNT_MEDIUM = 13
const CLUE_COUNT_HARD = 9

const getClueTarget = (difficulty: Difficulty): number => {
  if (difficulty === 'easy') {
    return CLUE_COUNT_EASY
  }
  if (difficulty === 'medium') {
    return CLUE_COUNT_MEDIUM
  }
  return CLUE_COUNT_HARD
}

/**
 * Stub generator for Phase 2: deterministic by date + difficulty, no clues yet.
 */
export const generateDailyPuzzle = (
  dateISO: string,
  difficulty: Difficulty
): PuzzleWithGrid => {
  const id = `${dateISO}:${difficulty}`
  const seed = `${dateISO}:${difficulty}`
  const rng = makeSeededRng(seed)

  const solution = generateFullSolution(rng)

  const target = getClueTarget(difficulty)
  const initial = carveToClueTarget(solution, target, rng)

  const fixed = [] as { r: number; c: number; v: 0 | 1 }[]
  for (let r = 0; r < SIZE; r++) {
    const row = ensureRow(initial, r)
    for (let c = 0; c < SIZE; c++) {
      const v = row[c] as Cell
      if (v === 0 || v === 1) {
        fixed.push({ r, c, v })
      }
    }
  }

  return { id, size: 6, difficulty, fixed, initial }
}

/**
 * Generate a unique puzzle for a specific post using postId as seed.
 * Each post will have its own unique puzzle that never changes.
 */
export const generatePuzzleForPost = (
  postId: string,
  difficulty: Difficulty
): PuzzleWithGrid => {
  const id = `${postId}:${difficulty}`
  const seed = `${postId}:${difficulty}:${Date.now()}`
  const rng = makeSeededRng(seed)

  const solution = generateFullSolution(rng)

  const target = getClueTarget(difficulty)
  const initial = carveToClueTarget(solution, target, rng)

  const fixed = [] as { r: number; c: number; v: 0 | 1 }[]
  for (let r = 0; r < SIZE; r++) {
    const row = ensureRow(initial, r)
    for (let c = 0; c < SIZE; c++) {
      const v = row[c] as Cell
      if (v === 0 || v === 1) {
        fixed.push({ r, c, v })
      }
    }
  }

  return { id, size: 6, difficulty, fixed, initial }
}

// ---------------- RNG ----------------

const FNV_OFFSET_BASIS = 2_166_136_261
const FNV_PRIME = 16_777_619
const UINT32_MAX = 4_294_967_296
const LCG_MULTIPLIER = 1_664_525
const LCG_INCREMENT = 1_013_904_223

const hashString = (s: string): number => {
  // Simple hash function without bitwise operations
  let h = FNV_OFFSET_BASIS % UINT32_MAX
  for (let i = 0; i < s.length; i++) {
    // Simulate XOR with modulo arithmetic
    const charCode = s.charCodeAt(i)
    h = ((h + charCode) * (charCode + 1)) % UINT32_MAX
    h = Math.imul(h, FNV_PRIME) % UINT32_MAX
  }
  return Math.abs(h) % UINT32_MAX
}

type Rng = () => number

const makeSeededRng = (seed: string): Rng => {
  let state = hashString(seed) || 1
  return () => {
    // Linear congruential generator
    state = (LCG_MULTIPLIER * state + LCG_INCREMENT) % UINT32_MAX
    return state / UINT32_MAX
  }
}

const shuffleInPlace = <T>(arr: T[], rnd: Rng): void => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const ai = arr[i] as T
    const aj = arr[j] as T
    arr[i] = aj
    arr[j] = ai
  }
}

// -------------- Constraints --------------

const countLine = (line: (0 | 1 | null)[]) => {
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

const TRIPLE_RUN_LENGTH = 3

const hasTripleRunAfterPlace = (
  line: (0 | 1 | null)[],
  idx: number,
  val: 0 | 1
): boolean => {
  const prev: 0 | 1 | null = (line[idx] ?? null) as 0 | 1 | null
  line[idx] = val
  let bad = false
  for (let i = 0; i <= line.length - TRIPLE_RUN_LENGTH; i++) {
    const a = line[i]
    const b = line[i + 1]
    const c = line[i + 2]
    if (a !== null && a === b && b === c) {
      bad = true
      break
    }
  }
  line[idx] = prev
  return bad
}

const MAX_COUNT_PER_LINE = 3

const canPlace = (grid: Grid, r: number, c: number, val: 0 | 1): boolean => {
  if (ensureRow(grid, r)[c] !== null) {
    return false
  }
  const rowCounts = countLine(ensureRow(grid, r))
  if (val === 0 && rowCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && rowCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }
  const col: (0 | 1 | null)[] = new Array(SIZE)
  for (let i = 0; i < SIZE; i++) {
    col[i] = ensureRow(grid, i)[c] as Cell
  }
  const colCounts = countLine(col)
  if (val === 0 && colCounts.zeros >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (val === 1 && colCounts.ones >= MAX_COUNT_PER_LINE) {
    return false
  }
  if (hasTripleRunAfterPlace(ensureRow(grid, r), c, val)) {
    return false
  }
  if (hasTripleRunAfterPlace(col, r, val)) {
    return false
  }
  return true
}

// -------------- Solver --------------

const cloneGrid = (g: Grid): Grid => g.map((row) => row.slice())

const generateFullSolution = (rnd: Rng): Grid => {
  const grid = makeEmptyGrid()
  const cells: Array<{ r: number; c: number }> = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      cells.push({ r, c })
    }
  }
  shuffleInPlace(cells, rnd)

  const tryFill = (idx: number): boolean => {
    if (idx === cells.length) {
      const res = validateGrid(grid, [])
      return res.ok
    }
    const cell = cells[idx]
    if (!cell) {
      return false
    }
    const r = cell.r
    const c = cell.c
    if (ensureRow(grid, r)[c] !== null) {
      return tryFill(idx + 1)
    }
    const values: (0 | 1)[] = [0, 1]
    shuffleInPlace(values, rnd)
    for (const v of values) {
      if (!canPlace(grid, r, c, v)) {
        continue
      }
      ensureRow(grid, r)[c] = v
      if (tryFill(idx + 1)) {
        return true
      }
      ensureRow(grid, r)[c] = null
    }
    return false
  }

  if (!tryFill(0)) {
    throw new Error('Failed to generate a valid solution')
  }
  return grid
}

const countSolutionsUpTo = (start: Grid, limit: number): number => {
  let solutions = 0
  const grid = cloneGrid(start)

  const findNext = (): { r: number; c: number } | null => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (ensureRow(grid, r)[c] === null) {
          return { r, c }
        }
      }
    }
    return null
  }

  const dfs = (): void => {
    if (solutions >= limit) {
      return
    }
    const spot = findNext()
    if (!spot) {
      const res = validateGrid(grid, [])
      if (res.ok) {
        solutions++
      }
      return
    }
    const r = spot.r
    const c = spot.c
    for (const v of [0, 1] as const) {
      if (!canPlace(grid, r, c, v)) {
        continue
      }
      ensureRow(grid, r)[c] = v
      dfs()
      if (solutions >= limit) {
        return
      }
      ensureRow(grid, r)[c] = null
    }
  }

  dfs()
  return solutions
}

// -------------- Carving --------------

const carveToClueTarget = (
  solution: Grid,
  targetClues: number,
  rnd: Rng
): Grid => {
  const work = cloneGrid(solution)
  const positions: Array<{ r: number; c: number }> = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      positions.push({ r, c })
    }
  }
  shuffleInPlace(positions, rnd)

  const totalCells = SIZE * SIZE
  let clues = totalCells
  for (const pos of positions) {
    const r = pos.r
    const c = pos.c
    if (clues <= targetClues) {
      break
    }
    const saved = ensureRow(work, r)[c] as Cell
    ensureRow(work, r)[c] = null
    const count = countSolutionsUpTo(work, 2)
    if (count !== 1) {
      ensureRow(work, r)[c] = saved
    } else {
      clues--
    }
  }
  return work
}
