import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, Grid } from '../../shared/types/puzzle'
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

export type GameState = {
	puzzleId: string | null
	difficulty: Difficulty
	grid: Grid
	initial: Grid
	fixed: { r: number; c: number; v: 0 | 1 }[]
	// Stack of prior grids; enables multi-level undo without mutating originals
	history: Grid[]
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
	history: [],
	status: 'idle',
	errors: [],
	errorLocations: undefined,
	solution: null,
	lastHint: null,
	dateISO: null
}

export const game = writable<GameState>(initial)

export const loadPuzzle = async (difficulty: Difficulty) => {
	resetTimer()
	closeSuccessModal()

	game.update((s) => ({ ...s, status: 'loading', errors: [] }))

	const res = await fetch(`/api/puzzle`)

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
		history: [],
		status: 'in_progress',
		errors: [],
		errorLocations: undefined,
		solution,
		lastHint: null,
		dateISO: ''
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
		return {
			...s,
			grid,
			history: [],
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
	game.update((s) => {
		if (s.status === 'solved') {
			return s
		}
		if (isCellFixed(s.fixed, r, c)) {
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
		const history = [...s.history, previousGrid]

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
			history,
			status,
			errors,
			errorLocations: undefined,
			lastHint: null
		}
	})
	if (solved) {
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
		// Record the state prior to mutation so undo can restore it later
		const history = [...s.history, cloneGrid(s.grid)]

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
			history,
			status,
			errors,
			errorLocations: undefined,
			lastHint: { r: choice.r, c: choice.c }
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

// Restore the most recent grid snapshot, respecting validation and timers
export const undoLastMove = () => {
	if (errorTimer) {
		clearTimeout(errorTimer)
		errorTimer = undefined
	}
	let resumeTimer = false
	game.update((s) => {
		if (s.history.length === 0) {
			return s
		}
		const history = s.history.slice()
		const previousGrid = history.pop()
		if (!previousGrid) {
			return s
		}
		const result = validateGrid(previousGrid, s.fixed)
		let status = determineStatus(result.ok, previousGrid)
		let errors = result.ok ? [] : result.errors

		if (!result.ok) {
			const currentGridJSON = JSON.stringify(previousGrid)
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
		resumeTimer = s.status === 'solved' && status !== 'solved'

		return {
			...s,
			grid: previousGrid,
			history,
			status,
			errors,
			errorLocations: undefined,
			lastHint: null
		}
	})
	if (resumeTimer) {
		startTimer()
		closeSuccessModal()
	}
}
