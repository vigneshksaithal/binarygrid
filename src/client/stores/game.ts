import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import { solvePuzzle } from '../../shared/solver'
import type {
  LeaderboardEntry,
  LeaderboardResponse
} from '../../shared/types/leaderboard'
import type {
  Cell,
  Difficulty,
  Grid,
  PuzzleWithGrid
} from '../../shared/types/puzzle'
import { isComplete, validateGrid } from '../../shared/validator'
import { recordCompletion } from './streak'
import { elapsedSeconds, resetTimer, startTimer, stopTimer } from './timer'
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
  lastHint: { r: number; c: number } | null
  leaderboard: {
    scores: LeaderboardEntry[]
    nextCursor: number | null
    loading: boolean
  }
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

type HintCandidate = { r: number; c: number; value: 0 | 1 }

const collectHintCandidates = (state: GameState): HintCandidate[] => {
  if (!state.solution) {
    return []
  }
  const blanks: HintCandidate[] = []
  const corrections: HintCandidate[] = []
  for (let r = 0; r < SIZE; r++) {
    const solutionRow = state.solution[r]
    const currentRow = state.grid[r]
    if (!(solutionRow && currentRow)) {
      continue
    }
    for (let c = 0; c < SIZE; c++) {
      const target = solutionRow[c]
      if (target !== 0 && target !== 1) {
        continue
      }
      if (isCellFixed(state.fixed, r, c)) {
        continue
      }
      const current = currentRow[c]
      if (current === target) {
        continue
      }
      const candidate = { r, c, value: target }
      if (current === null) {
        blanks.push(candidate)
      } else {
        corrections.push(candidate)
      }
    }
  }
  return blanks.length > 0 ? blanks : corrections
}

export const hasHintAvailable = (state: GameState): boolean =>
  collectHintCandidates(state).length > 0

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
  lastHint: null,
  leaderboard: {
    scores: [],
    nextCursor: null,
    loading: false
  }
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
  const solution = solvePuzzle(initialGrid, data.puzzle.fixed) ?? null
  game.update((s) => ({
    ...s,
    puzzleId: id,
    difficulty,
    grid,
    initial: initialGrid,
    fixed: data.puzzle.fixed,
    status: 'in_progress',
    errors: [],
    errorLocations: undefined as unknown as {
      rows: number[]
      columns: number[]
    },
    solution,
    lastHint: null,
    leaderboard: {
      scores: [],
      nextCursor: null,
      loading: false
    }
  }))
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
      errorLocations: undefined,
      lastHint: null
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
  let solvedDate: string | null = null
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
    if (solved) {
      solvedDate = new Date().toISOString().slice(0, 10)
    }

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
      errorLocations: undefined,
      lastHint: null
    }
  })
  if (solved) {
    recordCompletion(solvedDate ?? new Date().toISOString().slice(0, 10)).catch(
      () => undefined
    )
    stopTimer()
    openSuccessModal()
  }
}

export const revealHint = () => {
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = undefined
  }
  let solved = false
  let solvedDate: string | null = null
  game.update((s) => {
    if (!s.solution || s.status === 'solved') {
      return s
    }
    const candidates = collectHintCandidates(s)
    if (candidates.length === 0) {
      return s
    }
    const index = Math.floor(Math.random() * candidates.length)
    const choice = candidates[index]
    if (!choice) {
      return s
    }
    const nextGrid = s.grid.map((row) => row.slice())
    const nextRow = nextGrid[choice.r]
    if (!nextRow) {
      return s
    }
    nextRow[choice.c] = choice.value

    const result = validateGrid(nextGrid, s.fixed)
    let status = determineStatus(result.ok, nextGrid)
    let errors = result.ok ? [] : result.errors
    solved = status === 'solved'
    if (solved) {
      solvedDate = new Date().toISOString().slice(0, 10)
    }

    if (s.puzzleId && typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey(s.puzzleId), JSON.stringify(nextGrid))
    }

    if (!result.ok) {
      const currentGridJSON = JSON.stringify(nextGrid)
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
      lastHint: { r: choice.r, c: choice.c }
    }
  })
  if (solved) {
    recordCompletion(solvedDate ?? new Date().toISOString().slice(0, 10)).catch(
      () => undefined
    )
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
    body: JSON.stringify({
      id: snapshot.puzzleId,
      grid: snapshot.grid,
      score: get(elapsedSeconds)
    })
  })

  // After submitting, fetch the leaderboard
  fetchLeaderboard()
}

export const fetchLeaderboard = async (cursor?: number) => {
  game.update((s) => ({
    ...s,
    leaderboard: { ...s.leaderboard, loading: true }
  }))
  const url = cursor ? `/api/leaderboard?cursor=${cursor}` : '/api/leaderboard'
  const res = await fetch(url)
  if (!res.ok) {
    // Handle error
    return
  }
  const data = (await res.json()) as LeaderboardResponse
  game.update((s) => ({
    ...s,
    leaderboard: {
      scores: cursor ? [...s.leaderboard.scores, ...data.scores] : data.scores,
      nextCursor: data.nextCursor,
      loading: false
    }
  }))
}
