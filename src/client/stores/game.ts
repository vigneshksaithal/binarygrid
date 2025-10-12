import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import type {
  Cell,
  Difficulty,
  Grid,
  PuzzleWithGrid
} from '../../shared/types/puzzle'
import { isComplete, validateGrid } from '../../shared/validator'

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
  grid: Grid
  fixed: { r: number; c: number; v: 0 | 1 }[]
  status: Status
  errors: string[]
  errorLocations?:
    | {
        rows: number[]
        columns: number[]
      }
    | undefined
}

const emptyGrid = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

const initial: GameState = {
  puzzleId: null,
  difficulty: 'medium',
  grid: emptyGrid(),
  fixed: [],
  status: 'idle',
  errors: [],
  errorLocations: undefined
}

export const game = writable<GameState>(initial)

const storageKey = (id: string) => `binarygrid:${id}`

export const loadPuzzle = async (difficulty: Difficulty, dateISO?: string) => {
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
  const grid: Grid = saved ? JSON.parse(saved) : data.puzzle.initial
  game.set({
    puzzleId: id,
    difficulty,
    grid,
    fixed: data.puzzle.fixed,
    status: 'in_progress',
    errors: [],
    errorLocations: undefined as unknown as {
      rows: number[]
      columns: number[]
    }
  })
}

export const resetPuzzle = () => {
  game.update((s) => {
    if (!s.puzzleId) {
      return s
    }
    const grid = emptyGrid()
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

let errorTimer: ReturnType<typeof setTimeout> | undefined

export const cycleCell = (r: number, c: number) => {
	if (errorTimer) {
		clearTimeout(errorTimer)
		errorTimer = undefined
	}

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

		if (s.puzzleId && typeof localStorage !== 'undefined') {
			localStorage.setItem(storageKey(s.puzzleId), JSON.stringify(nextGrid))
		}

		const currentGridJSON = JSON.stringify(nextGrid)
		if (!result.ok) {
			errorTimer = setTimeout(() => {
				const currentGameState = get(game)
				if (
					JSON.stringify(currentGameState.grid) === currentGridJSON
				) {
					game.update((s) => ({
						...s,
						status: 'invalid',
						errors: result.errors,
						errorLocations: result.errorLocations
					}))
				}
			}, 3000)

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
