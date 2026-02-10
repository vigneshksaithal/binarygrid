import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import { findForcedMoves } from '../../shared/hints'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, Grid } from '../../shared/types/puzzle'
import { findErrorCells, isComplete, validateGrid } from '../../shared/validator'
import { resetHintCooldown, startCooldown } from './hint'
import { fetchRank, resetRank, setRank, setStreak } from './rank'
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
  errorCells: Set<string>
  solution: Grid | null
  dateISO: string | null
  history: Grid[]
  lastHintedCell: { r: number; c: number; at: number } | null
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
  errorCells: new Set(),
  solution: null,
  dateISO: null,
  history: [],
  lastHintedCell: null
}

export const game = writable<GameState>(initial)

export const loadPuzzle = async (difficulty: Difficulty) => {
  resetTimer()
  closeSuccessModal()
  resetHintCooldown()
  resetRank()
  setStreak(null, null)

  game.update((s) => ({
    ...s,
    status: 'loading',
    errors: [],
    errorLocations: undefined,
    errorCells: new Set(),
    lastHintedCell: null
  }))

  const res = await fetch(`/api/puzzle?difficulty=${difficulty}`)

  if (!res.ok) {
    game.update((s) => ({
      ...s,
      status: 'error',
      errors: ['failed to load puzzle', `HTTP ${res.status}`],
      errorLocations: undefined,
      errorCells: new Set()
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
    errorCells: new Set(),
    solution,
    dateISO: '',
    history: [],
    lastHintedCell: null
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

const ERROR_DISPLAY_DELAY = 1000
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
      const cellsWithErrors = findErrorCells(nextGrid)
      errorTimer = setTimeout(() => {
        const currentGameState = get(game)
        if (JSON.stringify(currentGameState.grid) === currentGridJSON) {
          game.update((gameState) => ({
            ...gameState,
            status: 'invalid',
            errors: result.errors,
            errorLocations: result.errorLocations,
            errorCells: cellsWithErrors
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
      errorCells: new Set(),
      history: [...s.history, previousGrid],
      lastHintedCell: null
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
      errorLocations: undefined,
      errorCells: new Set(),
      lastHintedCell: null
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
      // Get rank from submit response
      const data = await res.json()
      if (
        data.rank !== null &&
        data.rank !== undefined &&
        typeof data.totalEntries === 'number'
      ) {
        setRank(data.rank, data.totalEntries)
      } else {
        // Fallback to fetching rank if not in response
        await fetchRank(snapshot.puzzleId)
      }

      if (typeof data.streak === 'number' || typeof data.bestStreak === 'number') {
        setStreak(
          typeof data.streak === 'number' ? data.streak : null,
          typeof data.bestStreak === 'number' ? data.bestStreak : null
        )
      }

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

  const pickRandom = <T>(items: T[]): T | null => {
    if (items.length === 0) {
      return null
    }
    const index = Math.floor(Math.random() * items.length)
    return items[index] ?? null
  }

  const forcedMoves = findForcedMoves(snapshot.grid, snapshot.fixed)
  const matchingForcedMoves = forcedMoves.filter((move) => {
    const solutionRow = solution[move.r]
    return solutionRow ? solutionRow[move.c] === move.value : false
  })

  const forcedMove = pickRandom(matchingForcedMoves)

  let target: { r: number; c: number; value: 0 | 1 } | null = null

  if (forcedMove) {
    target = forcedMove
  } else {
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

    const randomCell = pickRandom(emptyCells)
    if (!randomCell) {
      return false
    }

    const solutionRow = solution[randomCell.r]
    if (!solutionRow) {
      return false
    }
    const correctValue = solutionRow[randomCell.c]
    if (correctValue === null || correctValue === undefined) {
      return false
    }

    target = { r: randomCell.r, c: randomCell.c, value: correctValue }
  }

  if (!target) {
    return false
  }

  const { r, c, value: correctValue } = target

  // Update the game state
  let solved = false
  let hintApplied = false
  game.update((s) => {
    const previousGrid = cloneGrid(s.grid)
    const nextGrid = s.grid.map((gridRow) => gridRow.slice())
    const targetRow = nextGrid[r]
    if (!targetRow) {
      return s
    }
    targetRow[c] = correctValue
    hintApplied = true

    const result = validateGrid(nextGrid, s.fixed)
    let status = determineStatus(result.ok, nextGrid)
    let errors = result.ok ? [] : result.errors
    solved = status === 'solved'

    const currentGridJSON = JSON.stringify(nextGrid)
    if (!result.ok) {
      const cellsWithErrors = findErrorCells(nextGrid)
      errorTimer = setTimeout(() => {
        const currentGameState = get(game)
        if (JSON.stringify(currentGameState.grid) === currentGridJSON) {
          game.update((gameState) => ({
            ...gameState,
            status: 'invalid',
            errors: result.errors,
            errorLocations: result.errorLocations,
            errorCells: cellsWithErrors
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
      errorCells: new Set(),
      history: [...s.history, previousGrid],
      lastHintedCell: { r, c, at: Date.now() }
    }
  })

  if (solved) {
    stopTimer()
    openSuccessModal()
  }

  // Start the cooldown timer only if hint was successfully applied
  if (hintApplied) {
    startCooldown()
    return true
  }

  return false
}
