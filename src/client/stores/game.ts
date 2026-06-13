import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, Grid } from '../../shared/types/puzzle'
import { cloneGrid, createEmptyGrid } from '../../shared/utils/grid'
import { findErrorCells, isComplete, validateGrid } from '../../shared/validator'
import { resetCoinReward, setCoinReward } from './coinReward'
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
  errorLocations?: { rows: number[]; columns: number[] }
  errorCells: Set<string>
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

const determineStatus = (isValid: boolean, grid: Grid): Status => {
  if (!isValid) return 'invalid'
  if (isComplete(grid)) return 'solved'
  return 'in_progress'
}

// Schedules the deferred error display after ERROR_DISPLAY_DELAY ms.
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
let lastSubmittedPuzzleId: string | null = null

const clearErrorTimer = () => {
  if (!errorTimer) return
  clearTimeout(errorTimer)
  errorTimer = undefined
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
  resetCoinReward()
  resetGrowth()

  game.update((s) => ({
    ...s,
    status: 'loading',
    errors: [],
    errorLocations: undefined,
    errorCells: new Set(),
  }))

  const res = await fetch(`/api/puzzle?difficulty=${difficulty}`)

  if (!res.ok) {
    game.update((s) => ({
      ...s,
      status: 'error',
      errors: ['failed to load puzzle', `HTTP ${res.status}`],
      errorLocations: undefined,
      errorCells: new Set(),
    }))
    return
  }

  const data = await res.json()
  const initialGrid = cloneGrid(data.puzzle.initial)
  const fixed = data.puzzle.fixed

  game.set({
    puzzleId: data.puzzle.id,
    difficulty,
    grid: cloneGrid(initialGrid),
    initial: initialGrid,
    fixed,
    fixedSet: createFixedSet(fixed),
    status: 'in_progress',
    errors: [],
    errorLocations: undefined,
    errorCells: new Set(),
    solution: solvePuzzle(initialGrid, fixed) ?? null,
    dateISO: '',
    history: [],
    hintsUsed: 0,
    mistakeCount: 0,
    undoCount: 0,
    firstInputTracked: false,
  })

  resetTimer()
  lastSubmittedPuzzleId = null
  trackGrowthEvent('puzzle_start')

  // Best-effort play count registration after 10 s of dwell time
  setTimeout(async () => {
    try {
      await fetch('/api/play-count', { method: 'POST' })
    } catch {
      // ignore — best effort only
    }
  }, 10000)
}

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

    const result = validateGrid(nextGrid, s.fixed)
    const status = determineStatus(result.ok, nextGrid)
    solved = status === 'solved'

    if (!result.ok) {
      errorTimer = scheduleErrorDisplay(nextGrid, result)
    }

    return {
      ...s,
      grid: nextGrid,
      // Show the cell change immediately; deferred timeout will surface errors
      status: result.ok ? status : 'in_progress',
      errors: result.ok ? result.errors : [],
      errorLocations: undefined,
      errorCells: new Set(),
      history: [...s.history, previousGrid],
      mistakeCount: result.ok ? s.mistakeCount : s.mistakeCount + 1,
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
    if (s.history.length === 0) return s
    return {
      ...s,
      grid: s.history[s.history.length - 1]!,
      history: s.history.slice(0, -1),
      status: 'in_progress',
      errors: [],
      errorLocations: undefined,
      errorCells: new Set(),
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

    const result = validateGrid(nextGrid, s.fixed)
    const status = determineStatus(result.ok, nextGrid)
    solved = status === 'solved'

    if (!result.ok) {
      errorTimer = scheduleErrorDisplay(nextGrid, result)
    }

    return {
      ...s,
      grid: nextGrid,
      status: result.ok ? status : 'in_progress',
      errors: result.ok ? result.errors : [],
      errorLocations: undefined,
      errorCells: new Set(),
      history: [...s.history, previousGrid],
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

export const autosubmitIfSolved = async () => {
  const snapshot = get(game)

  if (snapshot.status !== 'solved' || !snapshot.puzzleId) return
  if (snapshot.puzzleId === lastSubmittedPuzzleId) return

  const timeSeconds = get(elapsedSeconds)

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: snapshot.puzzleId,
        grid: snapshot.grid,
        solveTimeSeconds: timeSeconds,
        hintsUsed: snapshot.hintsUsed,
        mistakeCount: snapshot.mistakeCount,
        undoCount: snapshot.undoCount,
      }),
    })

    if (!res.ok) return

    lastSubmittedPuzzleId = snapshot.puzzleId
    const data = await res.json()

    if (data.rank !== null && data.rank !== undefined && typeof data.totalEntries === 'number') {
      setRank(data.rank, data.totalEntries)
    } else {
      await fetchRank(snapshot.puzzleId)
    }

    if (data.streak) updateStreakFromSubmit(data.streak)
    if (data.coinReward) setCoinReward(data.coinReward)
    if (data.solveQuality) setSolveQuality(data.solveQuality)

    if (data.dailyProgress) {
      setDailyProgress(data.dailyProgress)
    } else {
      await loadDailyProgress()
    }

    if (data.playerContext) {
      setPlayerContext(data.playerContext)
    } else {
      await loadPlayerContext(snapshot.puzzleId)
    }
  } catch {
    // ignore network errors — autosubmit is best effort
  }
}
