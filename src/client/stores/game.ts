import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, Grid } from '../../shared/types/puzzle'
import { isComplete, validateGrid } from '../../shared/validator'
import { resetHintCooldown, startCooldown } from './hint'
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
  fixedSet: Set<string>
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
  history: Grid[]
}

const emptyGrid = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

const cloneGrid = (grid: Grid): Grid =>
  grid.map((row) => row.map((cell) => cell))

/**
 * Creates a Set for O(1) fixed cell lookups.
 * Key format: "r,c"
 */
const createFixedSet = (fixed: { r: number; c: number; v: 0 | 1 }[]): Set<string> => {
  const set = new Set<string>()
  for (const f of fixed) {
    set.add(`${f.r},${f.c}`)
  }
  return set
}

const isCellFixed = (
  fixedSet: Set<string>,
  r: number,
  c: number
): boolean => fixedSet.has(`${r},${c}`)

const initial: GameState = {
  puzzleId: null,
  difficulty: 'medium',
  grid: emptyGrid(),
  initial: emptyGrid(),
  fixed: [],
  fixedSet: new Set(),
  status: 'idle',
  errors: [],
  errorLocations: undefined,
  solution: null,
  dateISO: null,
  history: []
}

export const game = writable<GameState>(initial)

export const loadPuzzle = async (difficulty: Difficulty) => {
  resetTimer()
  closeSuccessModal()
  resetHintCooldown()

  game.update((s) => ({ ...s, status: 'loading', errors: [] }))

  const res = await fetch(`/api/puzzle?difficulty=${difficulty}`)

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
  const fixed = data.puzzle.fixed
  const fixedSet = createFixedSet(fixed)
  const solution = solvePuzzle(initialGrid, fixed) ?? null

  game.set({
    puzzleId: id,
    difficulty,
    grid,
    initial: initialGrid,
    fixed,
    fixedSet,
    status: 'in_progress',
    errors: [],
    errorLocations: undefined,
    solution,
    dateISO: '',
    history: []
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
    if (isCellFixed(s.fixedSet, r, c)) {
      return s
    }
    const previousGrid = cloneGrid(s.grid)
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
      errorLocations: undefined,
      history: [...s.history, previousGrid]
    }
  })
  if (solved) {
    stopTimer()
    openSuccessModal()
  }
}

export const undo = () => {
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = undefined
  }

  resetHintCooldown()

  game.update((s) => {
    if (s.history.length === 0) {
      return s
    }
    const previousGrid = s.history[s.history.length - 1]!
    const newHistory = s.history.slice(0, -1)
    return {
      ...s,
      grid: previousGrid,
      history: newHistory,
      status: 'in_progress',
      errors: [],
      errorLocations: undefined
    }
  })
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

export const useHint = (): boolean => {
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = undefined
  }

  const snapshot = get(game)

  // Can only use hint during active game with a solution
  if (snapshot.status !== 'in_progress' || !snapshot.solution) {
    return false
  }

  const solution = snapshot.solution

  // Find all empty cells that are not fixed
  const emptyCells: { r: number; c: number }[] = []
  for (let r = 0; r < SIZE; r++) {
    const row = snapshot.grid[r]
    if (!row) continue
    for (let c = 0; c < SIZE; c++) {
      if (row[c] === null && !isCellFixed(snapshot.fixedSet, r, c)) {
        emptyCells.push({ r, c })
      }
    }
  }

  // No empty cells to fill
  if (emptyCells.length === 0) {
    return false
  }

  // Pick a random empty cell
  const randomIndex = Math.floor(Math.random() * emptyCells.length)
  const cell = emptyCells[randomIndex]
  if (!cell) {
    return false
  }
  const { r, c } = cell

  // Get the correct value from the solution
  const solutionRow = solution[r]
  if (!solutionRow) {
    return false
  }
  const correctValue = solutionRow[c]
  if (correctValue === null || correctValue === undefined) {
    return false
  }

  // Update the game state
  let solved = false
  game.update((s) => {
    const previousGrid = cloneGrid(s.grid)
    const nextGrid = s.grid.map((gridRow) => gridRow.slice())
    const targetRow = nextGrid[r]
    if (!targetRow) {
      return s
    }
    targetRow[c] = correctValue

    const result = validateGrid(nextGrid, s.fixed)
    const status = determineStatus(result.ok, nextGrid)
    solved = status === 'solved'

    return {
      ...s,
      grid: nextGrid,
      status,
      errors: result.ok ? [] : result.errors,
      errorLocations: result.ok ? undefined : result.errorLocations,
      history: [...s.history, previousGrid]
    }
  })

  if (solved) {
    stopTimer()
    openSuccessModal()
  }

  // Start the cooldown timer
  startCooldown()

  return true
}
