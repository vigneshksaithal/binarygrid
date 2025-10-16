import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import type {
  Cell,
  Difficulty,
  Grid,
  PuzzleWithGrid
} from '../../shared/types/puzzle'
import { isComplete, validateGrid } from '../../shared/validator'
import { resetTimer, startTimer, stopTimer } from './timer'
import { closeSuccessModal, openSuccessModal } from './ui'

type Status =
  | 'idle'
  | 'loading'
  | 'in_progress'
  | 'solved'
  | 'invalid'
  | 'error'

type GameState = {
  puzzleId: string | null
  difficulty: Difficulty
  solution: Grid
  grid: Grid
  initial: Grid
  fixed: { r: number; c: number; v: 0 | 1 }[]
  status: Status
  errors: string[]
  errorLocations?:
    | {
        rows: number[]
        columns: number[]
      }
    | undefined
  hintUsed?: boolean
}

const emptyGrid = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

const cloneGrid = (grid: Grid): Grid =>
  grid.map((row) => row.map((cell) => cell))

const initial: GameState = {
  puzzleId: null,
  difficulty: 'medium',
  solution: emptyGrid(),
  grid: emptyGrid(),
  initial: emptyGrid(),
  fixed: [],
  status: 'idle',
  errors: [],
  errorLocations: undefined
}

export const game = writable<GameState>(initial)

const storageKey = (id: string) => `binarygrid:${id}`

export const loadPuzzle = async (difficulty: Difficulty, dateISO?: string) => {
  resetTimer()
  closeSuccessModal()
  game.update((s) => ({ ...s, status: 'loading', errors: [] }))
  const date = dateISO ?? new Date().toISOString().slice(0, 10)
  const res = await fetch(`/api/puzzle?date=${date}&difficulty=${difficulty}`)
  if (!res.ok) {
    game.update((s) => ({
      ...s,
      status: 'error',
      errors: ['failed to load puzzle']
    }))
    return
  }
  const data = (await res.json()) as { puzzle: PuzzleWithGrid }
  const id = data.puzzle.id
  const saved =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(storageKey(id))
      : null
  const initialGrid = cloneGrid(data.puzzle.initial)
  const grid: Grid = saved ? JSON.parse(saved) : cloneGrid(initialGrid)
  game.set({
    puzzleId: id,
    difficulty,
    grid,
    initial: initialGrid,
    solution: data.puzzle.solution,
    fixed: data.puzzle.fixed,
    status: 'in_progress',
    errors: [],
    errorLocations: undefined as unknown as {
      rows: number[]
      columns: number[]
    }
  })
  resetTimer()
  startTimer()
}

export const resetPuzzle = () => {
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = undefined
  }
  let didReset = false
  game.update((s) => {
    if (!s.puzzleId) {
      return s
    }
    didReset = true
    const grid = cloneGrid(s.initial)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(storageKey(s.puzzleId))
    }
    return {
      ...s,
      grid,
      status: 'in_progress',
      errors: [],
      errorLocations: undefined
    }
  })
  if (didReset) {
    resetTimer()
    startTimer()
    closeSuccessModal()
  }
}

const getNextCellValue = (current: Cell): Cell => {
  if (current === null) {
    return 0
  }
  if (current === 0) {
    return 1
  }
  return null
}

const determineStatus = (isValid: boolean, grid: Grid): Status => {
  if (!isValid) {
    return 'invalid'
  }
  if (isComplete(grid)) {
    return 'solved'
  }
  return 'in_progress'
}

const ERROR_DISPLAY_DELAY = 3000
let errorTimer: ReturnType<typeof setTimeout> | undefined

export const cycleCell = (r: number, c: number) => {
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = undefined
  }

  let solved = false
  game.update((s) => {
    if (s.status === 'solved') {
      return s
    }
    const isFixed = s.fixed.some((f) => f.r === r && f.c === c)
    if (isFixed) {
      return s
    }
    const nextGrid = s.grid.map((gridRow) => gridRow.slice())
    const targetRow = nextGrid[r]
    if (!targetRow) {
      return s
    }
    const currentValue = targetRow[c] as Cell
    targetRow[c] = getNextCellValue(currentValue)

    const result = validateGrid(nextGrid, s.fixed)
    let status = determineStatus(result.ok, nextGrid)
    let errors = result.ok ? [] : result.errors
    solved = status === 'solved'

    if (s.puzzleId && typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey(s.puzzleId), JSON.stringify(nextGrid))
    }

    const currentGridJSON = JSON.stringify(nextGrid)
    if (!result.ok) {
      errorTimer = setTimeout(() => {
        const currentGameState = get(game)
        if (JSON.stringify(currentGameState.grid) === currentGridJSON) {
          game.update((gameState) => ({
            ...gameState,
            status: 'invalid',
            errors: result.errors,
            errorLocations: result.errorLocations
          }))
        }
      }, ERROR_DISPLAY_DELAY)

      status = 'in_progress'
      errors = []
    }

    return {
      ...s,
      grid: nextGrid,
      status,
      errors,
      errorLocations: undefined
    }
  })
  if (solved) {
    stopTimer()
    openSuccessModal()
  }
}

export const autosubmitIfSolved = async () => {
  const snapshot = get(game)
  if (!snapshot || snapshot.status !== 'solved' || !snapshot.puzzleId) {
    return
  }
  await fetch('/api/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: snapshot.puzzleId, grid: snapshot.grid })
  })
}

const HINT_COOLDOWN = 2000
let hintTimer: ReturnType<typeof setTimeout> | undefined

export const giveHint = () => {
  if (hintTimer) {
    clearTimeout(hintTimer)
    hintTimer = undefined
  }
  let solved = false
  game.update((s) => {
    if (s.status === 'solved' || s.hintUsed) {
      return s
    }
    const emptyCells: { r: number; c: number }[] = []
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (s.grid[r]?.[c] === null) {
          emptyCells.push({ r, c })
        }
      }
    }
    if (emptyCells.length === 0) {
      return s
    }
    const randomIndex = Math.floor(Math.random() * emptyCells.length)
    const cellToFill = emptyCells[randomIndex]
    if (!cellToFill) {
      return s
    }
    const { r, c } = cellToFill
    const solutionValue = s.solution[r]?.[c]
    if (solutionValue === undefined || solutionValue === null) {
      return s
    }
    const nextGrid = cloneGrid(s.grid)
    const targetRow = nextGrid[r]
    if (!targetRow) {
      return s
    }
    targetRow[c] = solutionValue
    const result = validateGrid(nextGrid, s.fixed)
    const status = determineStatus(result.ok, nextGrid)
    solved = status === 'solved'
    if (s.puzzleId && typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey(s.puzzleId), JSON.stringify(nextGrid))
    }
    hintTimer = setTimeout(() => {
      game.update((g) => ({ ...g, hintUsed: false }))
    }, HINT_COOLDOWN)

    return {
      ...s,
      grid: nextGrid,
      status,
      hintUsed: true,
      errors: result.ok ? [] : result.errors,
      errorLocations: result.ok ? undefined : result.errorLocations
    }
  })
  if (solved) {
    stopTimer()
    openSuccessModal()
  }
}
