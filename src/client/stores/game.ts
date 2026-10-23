import { get, writable } from 'svelte/store'
import { chargedCells, chargeTap, standingCharges } from '../../shared/clean'
import { SCORING_VERSION } from '../../shared/growth'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, FixedCell, Grid } from '../../shared/types/puzzle'
import { cloneGrid, createEmptyGrid } from '../../shared/utils/grid'
import { cellKey, findErrorCells, isComplete, validateGrid } from '../../shared/validator'
import { fetchPuzzle } from '../services/puzzle-api'
import {
  loadDailyProgress,
  loadPlayerContext,
  resetGrowth,
  setDailyProgress,
  setPlayerContext,
  setSolveQuality,
  trackGrowthEvent,
} from './growth'
import { resetHintCooldown, startCooldown } from './hint'
import { fetchRank, resetRank, setRank } from './rank'
import { updateStreakFromSubmit } from './streak'
import { startAttempt, submitSolve, type SubmitResponse } from './submit'
import { elapsedSeconds, resetTimer, startTimer, stopTimer } from './timer'
import { closeSuccessModal, openSuccessModal } from './ui'

type Status = 'idle' | 'loading' | 'in_progress' | 'solved' | 'invalid' | 'error'

export type GameState = {
  puzzleId: string | null
  difficulty: Difficulty
  grid: Grid
  initial: Grid
  fixed: { r: number; c: number; v: 0 | 1 }[]
  fixedSet: Set<string>
  status: Status
  errors: string[]
  errorLocations?: { rows: number[]; columns: number[] } | undefined
  errorCells: Set<string>
  /** Ids of violations already charged as mistakes that still stand (src/shared/clean.ts). */
  chargedViolations: Set<string>
  solution: Grid | null
  dateISO: string | null
  history: Grid[]
  hintsUsed: number
  mistakeCount: number
  undoCount: number
  firstInputTracked: boolean
}

// --- helpers ---

const createFixedSet = (fixed: { r: number; c: number; v: 0 | 1 }[]): Set<string> =>
  new Set(fixed.map((f) => `${f.r},${f.c}`))

const isCellFixed = (fixedSet: Set<string>, r: number, c: number): boolean =>
  fixedSet.has(`${r},${c}`)

const NEXT_CELL_VALUE: Record<string, Cell> = { null: 0, '0': 1, '1': null }
const getNextCellValue = (current: Cell): Cell => NEXT_CELL_VALUE[String(current)] ?? null

// Schedules the free preview: after ERROR_DISPLAY_DELAY ms without a change,
// every standing violation shows its ✕, charged or not. It never costs a mistake.
// Returns the timeout handle so the caller can cancel it on the next interaction.
const ERROR_DISPLAY_DELAY = 1000

const scheduleErrorDisplay = (
  nextGrid: Grid,
  result: ReturnType<typeof validateGrid>
): ReturnType<typeof setTimeout> => {
  const gridSnapshot = JSON.stringify(nextGrid)
  const cellsWithErrors = findErrorCells(nextGrid)
  return setTimeout(() => {
    const current = get(game)
    if (JSON.stringify(current.grid) === gridSnapshot) {
      game.update((s) => ({
        ...s,
        status: 'invalid',
        errors: result.errors,
        errorLocations: result.errorLocations,
        errorCells: cellsWithErrors,
      }))
    }
  }, ERROR_DISPLAY_DELAY)
}

// --- initial state ---

const initial: GameState = {
  puzzleId: null,
  difficulty: 'medium',
  grid: createEmptyGrid(),
  initial: createEmptyGrid(),
  fixed: [],
  fixedSet: new Set(),
  status: 'idle',
  errors: [],
  errorLocations: undefined,
  errorCells: new Set(),
  chargedViolations: new Set(),
  solution: null,
  dateISO: null,
  history: [],
  hintsUsed: 0,
  mistakeCount: 0,
  undoCount: 0,
  firstInputTracked: false,
}

export const game = writable<GameState>(initial)

// --- module-level side-effect state ---

let errorTimer: ReturnType<typeof setTimeout> | undefined

const clearErrorTimer = () => {
  if (!errorTimer) return
  clearTimeout(errorTimer)
  errorTimer = undefined
}

type ErrorDisplay = Pick<GameState, 'status' | 'errors' | 'errorLocations' | 'errorCells'>

// Shows the errors on a changed grid. Charged violations keep their ✕ until
// fixed; the rest wait for the free preview. Status is 'invalid' exactly while
// a ✕ shows, as before, so hints stay unavailable while an error is marked.
const showErrorsFor = (
  grid: Grid,
  fixed: FixedCell[],
  charged: ReadonlySet<string>
): ErrorDisplay => {
  const result = validateGrid(grid, fixed)
  if (result.ok) {
    return {
      status: isComplete(grid) ? 'solved' : 'in_progress',
      errors: [],
      errorLocations: undefined,
      errorCells: new Set(),
    }
  }

  errorTimer = scheduleErrorDisplay(grid, result)
  const errorCells = chargedCells(grid, charged)
  if (errorCells.size === 0) {
    return { status: 'in_progress', errors: [], errorLocations: undefined, errorCells }
  }
  return {
    status: 'invalid',
    errors: result.errors,
    errorLocations: result.errorLocations,
    errorCells,
  }
}

// Starts the game timer on the player's first interaction (cell tap or hint).
// No-op if the player has already interacted this round.
const startTimerOnFirstInput = (wasTracked: boolean) => {
  if (!wasTracked) startTimer()
}

// --- public actions ---

export const loadPuzzle = async (difficulty: Difficulty) => {
  resetTimer()
  closeSuccessModal()
  resetHintCooldown()
  resetRank()
  resetGrowth()
  startAttempt()

  // The tier is set now, so Retry after a failed load asks for the same one.
  game.update((s) => ({
    ...s,
    difficulty,
    status: 'loading',
    errors: [],
    errorLocations: undefined,
    errorCells: new Set(),
  }))

  const puzzle = await fetchPuzzle(difficulty)

  if (!puzzle) {
    game.update((s) => ({
      ...s,
      status: 'error',
      errors: ['failed to load puzzle'],
      errorLocations: undefined,
      errorCells: new Set(),
    }))
    return
  }

  const initialGrid = cloneGrid(puzzle.initial)
  const fixed = puzzle.fixed

  game.set({
    puzzleId: puzzle.id,
    difficulty,
    grid: cloneGrid(initialGrid),
    initial: initialGrid,
    fixed,
    fixedSet: createFixedSet(fixed),
    status: 'in_progress',
    errors: [],
    errorLocations: undefined,
    errorCells: new Set(),
    chargedViolations: new Set(),
    solution: solvePuzzle(initialGrid, fixed) ?? null,
    dateISO: '',
    history: [],
    hintsUsed: 0,
    mistakeCount: 0,
    undoCount: 0,
    firstInputTracked: false,
  })

  resetTimer()
  trackGrowthEvent('puzzle_start')
}

/** Loads the tier that failed to load again, from the grid's Retry. */
export const retryPuzzleLoad = () => loadPuzzle(get(game).difficulty)

export const cycleCell = (r: number, c: number) => {
  clearErrorTimer()

  const snapshot = get(game)

  if (
    snapshot.status === 'solved' ||
    snapshot.status === 'loading' ||
    isCellFixed(snapshot.fixedSet, r, c)
  ) return

  const wasFirstInput = !snapshot.firstInputTracked && snapshot.status === 'in_progress'
  let solved = false

  game.update((s) => {
    const previousGrid = cloneGrid(s.grid)
    const nextGrid = s.grid.map((row) => row.slice())
    const targetRow = nextGrid[r]
    if (!targetRow) return s

    targetRow[c] = getNextCellValue(targetRow[c] as Cell)

    const charge = chargeTap({
      before: s.grid,
      after: nextGrid,
      tappedCell: cellKey(r, c),
      charged: s.chargedViolations,
    })
    const display = showErrorsFor(nextGrid, s.fixed, charge.charged)
    solved = display.status === 'solved'

    return {
      ...s,
      ...display,
      grid: nextGrid,
      history: [...s.history, previousGrid],
      chargedViolations: charge.charged,
      mistakeCount: s.mistakeCount + charge.mistakes,
      firstInputTracked: s.firstInputTracked || wasFirstInput,
    }
  })

  if (wasFirstInput) {
    trackGrowthEvent('first_input')
    startTimer()
  }

  if (solved) {
    stopTimer()
    openSuccessModal()
  }
}

export const undo = () => {
  clearErrorTimer()
  resetHintCooldown()

  game.update((s) => {
    const grid = s.history.at(-1)
    if (!grid) return s

    // Undo never refunds a mistake: a charged violation it leaves standing keeps its ✕.
    const chargedViolations = standingCharges(grid, s.chargedViolations)
    return {
      ...s,
      ...showErrorsFor(grid, s.fixed, chargedViolations),
      grid,
      history: s.history.slice(0, -1),
      chargedViolations,
      undoCount: s.undoCount + 1,
    }
  })
}

export const useHint = (): boolean => {
  clearErrorTimer()

  const snapshot = get(game)

  if (snapshot.status !== 'in_progress' || !snapshot.solution) return false

  const emptyCells = snapshot.grid.flatMap((row, r) =>
    row
      .map((cell, c) => ({ r, c, cell }))
      .filter(({ cell, c }) => cell === null && !isCellFixed(snapshot.fixedSet, r, c))
  )

  if (emptyCells.length === 0) return false

  const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)]!
  const correctValue = snapshot.solution[r]?.[c]

  if (correctValue === null || correctValue === undefined) return false

  let solved = false

  game.update((s) => {
    const previousGrid = cloneGrid(s.grid)
    const nextGrid = s.grid.map((row) => row.slice())
    const targetRow = nextGrid[r]
    if (!targetRow) return s

    targetRow[c] = correctValue

    // Only taps are judged for mistakes; a hint just keeps the charges still standing.
    const chargedViolations = standingCharges(nextGrid, s.chargedViolations)
    const display = showErrorsFor(nextGrid, s.fixed, chargedViolations)
    solved = display.status === 'solved'

    return {
      ...s,
      ...display,
      grid: nextGrid,
      history: [...s.history, previousGrid],
      chargedViolations,
      hintsUsed: s.hintsUsed + 1,
      firstInputTracked: true,
    }
  })

  if (solved) {
    stopTimer()
    openSuccessModal()
  }

  startTimerOnFirstInput(snapshot.firstInputTracked)
  startCooldown()
  return true
}

// Fills the result screen from a saved solve: rank, streak, label and progress.
const showSubmitResult = (puzzleId: string) => async (data: SubmitResponse) => {
  if (data.rank !== null && data.rank !== undefined && typeof data.totalEntries === 'number') {
    setRank(data.rank, data.totalEntries)
  } else {
    await fetchRank(puzzleId)
  }

  if (data.streak) updateStreakFromSubmit(data.streak)
  if (data.solveQuality) setSolveQuality(data.solveQuality)

  if (data.dailyProgress) {
    setDailyProgress(data.dailyProgress)
  } else {
    await loadDailyProgress()
  }

  if (data.playerContext) {
    setPlayerContext(data.playerContext)
  } else {
    await loadPlayerContext(puzzleId)
  }
}

// Saves a solved puzzle through the submit store, which shows the save status
// and retries failures; repeat calls for the same puzzle load send nothing.
export const autosubmitIfSolved = async () => {
  const snapshot = get(game)

  if (snapshot.status !== 'solved' || !snapshot.puzzleId) return

  const timeSeconds = get(elapsedSeconds)

  await submitSolve(
    {
      id: snapshot.puzzleId,
      grid: snapshot.grid,
      solveTimeSeconds: timeSeconds,
      hintsUsed: snapshot.hintsUsed,
      mistakeCount: snapshot.mistakeCount,
      undoCount: snapshot.undoCount,
      scoringVersion: SCORING_VERSION,
    },
    showSubmitResult(snapshot.puzzleId)
  )
}
