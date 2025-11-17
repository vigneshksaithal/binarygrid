import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, Grid } from '../../shared/types/puzzle'
import { isComplete, validateGrid } from '../../shared/validator'
import { elapsedSeconds, resetTimer, stopTimer } from './timer'
import { closeSuccessModal, openSuccessModal } from './ui'

type Status =
  | 'idle'
  | 'loading'
  | 'in_progress'
  | 'solved'
  | 'invalid'
  | 'error'

export type GameState = {
  puzzleId: string | null
  difficulty: Difficulty
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
  solution: Grid | null
  dateISO: string | null
}

const emptyGrid = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

const cloneGrid = (grid: Grid): Grid =>
  grid.map((row) => row.map((cell) => cell))

const isCellFixed = (
  fixed: GameState['fixed'],
  r: number,
  c: number
): boolean => fixed.some((f) => f.r === r && f.c === c)

const initial: GameState = {
  puzzleId: null,
  difficulty: 'medium',
  grid: emptyGrid(),
  initial: emptyGrid(),
  fixed: [],
  status: 'idle',
  errors: [],
  errorLocations: undefined,
  solution: null,
  dateISO: null
}

export const game = writable<GameState>(initial)

export const loadPuzzle = async (difficulty: Difficulty) => {
  resetTimer()
  closeSuccessModal()

  game.update((s) => ({ ...s, status: 'loading', errors: [] }))

  const res = await fetch('/api/puzzle')

  if (!res.ok) {
    game.update((s) => ({
      ...s,
      status: 'error',
      errors: ['failed to load puzzle', `HTTP ${res.status}`]
    }))

    return
  }

  const data = await res.json()

  const id = data.puzzle.id
  const initialGrid = cloneGrid(data.puzzle.initial)
  const grid = cloneGrid(initialGrid)
  const solution = solvePuzzle(initialGrid, data.puzzle.fixed) ?? null

  game.set({
    puzzleId: id,
    difficulty,
    grid,
    initial: initialGrid,
    fixed: data.puzzle.fixed,
    status: 'in_progress',
    errors: [],
    errorLocations: undefined,
    solution,
    dateISO: ''
  })

  resetTimer()
  lastSubmittedPuzzleId = null
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
let lastSubmittedPuzzleId: string | null = null

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
    if (isCellFixed(s.fixed, r, c)) {
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
  if (snapshot.puzzleId === lastSubmittedPuzzleId) {
    return
  }

  const timeSeconds = get(elapsedSeconds)

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: snapshot.puzzleId,
        grid: snapshot.grid,
        solveTimeSeconds: timeSeconds
      })
    })
    if (res.ok) {
      lastSubmittedPuzzleId = snapshot.puzzleId
    }
  } catch {
    // ignore network errors - autosubmit best effort only
  }
}
