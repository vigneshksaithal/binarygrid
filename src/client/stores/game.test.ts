import * as fc from 'fast-check'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveSolveQuality, SCORING_VERSION } from '../../shared/growth'
import { solvePuzzle } from '../../shared/solver'
import type { Cell, Difficulty, FixedCell, Grid } from '../../shared/types/puzzle'
import { createEmptyGrid } from '../../shared/utils/grid'
import { generateDailyPuzzle } from '../../server/core/generator'
import { autosubmitIfSolved, cycleCell, game, loadPuzzle, undo } from './game'

type ServedPuzzle = {
  id: string
  difficulty: Difficulty
  initial: Grid
  fixed: FixedCell[]
}

type CellPosition = { r: number; c: number }

// Tap speeds from the acceptance tests: a brisk player never waits out the
// one-second preview, a slow one sees it before every second tap.
const FAST_TAP_MS = 300
const SLOW_TAP_MS = 1500
const TAP_SPEEDS_MS = [FAST_TAP_MS, SLOW_TAP_MS]
const LONG_PAUSE_MS = 5000
const MAX_TAPS_PER_CELL = 3
const REPLAYS_PER_SPEED = 24

const PUZZLE_DATES = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']
const TIERS: readonly Difficulty[] = ['easy', 'medium', 'hard']

const BLANK_PUZZLE: ServedPuzzle = {
  id: 'blank:medium',
  difficulty: 'medium',
  initial: createEmptyGrid(),
  fixed: [],
}

// Three taps that leave ○○○ in row 0, and five more that each place a ○
// breaking no rule, away from that triple.
const TRIPLE_TAPS: readonly CellPosition[] = [
  { r: 0, c: 0 },
  { r: 0, c: 1 },
  { r: 0, c: 2 },
]
const TRIPLE_CELLS = new Set(['0,0', '0,1', '0,2'])
const FIVE_TAPS_ELSEWHERE: readonly CellPosition[] = [
  { r: 2, c: 4 },
  { r: 3, c: 3 },
  { r: 3, c: 5 },
  { r: 4, c: 4 },
  { r: 5, c: 3 },
]

const valueAt = (grid: Grid, { r, c }: CellPosition): Cell => grid[r]?.[c] ?? null

const emptyCells = (grid: Grid): CellPosition[] =>
  grid.flatMap((row, r) => row.flatMap((value, c) => (value === null ? [{ r, c }] : [])))

const fakeResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

// Serves the puzzle to the real store and answers every other call with ok.
const playPuzzle = async (puzzle: ServedPuzzle) => {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    fakeResponse(url.startsWith('/api/puzzle?') ? { puzzle } : { ok: true })
  )
  vi.stubGlobal('fetch', fetchMock)
  await loadPuzzle(puzzle.difficulty)
  return fetchMock
}

const tap = ({ r, c }: CellPosition, pauseMs = FAST_TAP_MS) => {
  cycleCell(r, c)
  vi.advanceTimersByTime(pauseMs)
}

const tapEach = (cells: readonly CellPosition[], pauseMs = FAST_TAP_MS) => {
  for (const cell of cells) tap(cell, pauseMs)
}

// A flawless player taps each cell straight to its answer: once for ○,
// twice for |, which passes through a ○ that may break a rule.
const replay = (solution: Grid, order: readonly CellPosition[], pauseMs: number) => {
  for (const cell of order) {
    for (
      let taps = 0;
      taps < MAX_TAPS_PER_CELL && valueAt(get(game).grid, cell) !== valueAt(solution, cell);
      taps++
    ) {
      tap(cell, pauseMs)
    }
  }
}

// Fills the remaining cells flawlessly, toward a solution that keeps every filled cell.
const finishFlawlessly = (pauseMs: number) => {
  const { grid } = get(game)
  const solution = solvePuzzle(grid, [])
  if (!solution) throw new Error('The current grid has no solution')
  replay(solution, emptyCells(grid), pauseMs)
}

const generatedPuzzles = PUZZLE_DATES.flatMap((date) =>
  TIERS.map((tier) => {
    const { id, difficulty, initial, fixed } = generateDailyPuzzle(date, tier)
    const solution = solvePuzzle(initial, fixed)
    if (!solution) throw new Error(`Puzzle ${id} has no solution`)
    return { puzzle: { id, difficulty, initial, fixed }, solution }
  })
)

// A real generated puzzle, with its empty cells in any order.
const anyFlawlessReplay = fc.constantFrom(...generatedPuzzles).chain((generated) => {
  const cells = emptyCells(generated.puzzle.initial)
  return fc.tuple(fc.constant(generated), fc.shuffledSubarray(cells, { minLength: cells.length }))
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('cycleCell mistake counting', () => {
  it.each(TAP_SPEEDS_MS)(
    'reads a flawless replay as Clean at %i ms per tap, in any tap order',
    async (pauseMs) => {
      await fc.assert(
        fc.asyncProperty(anyFlawlessReplay, async ([{ puzzle, solution }, order]) => {
          await playPuzzle(puzzle)
          replay(solution, order, pauseMs)

          const state = get(game)
          expect(state.status).toBe('solved')
          expect(state.mistakeCount).toBe(0)
          expect(deriveSolveQuality(state)).toBe('clean')
        }),
        { numRuns: REPLAYS_PER_SPEED }
      )
    }
  )

  it('shows the free preview on a passing ○ that breaks a rule, and charges nothing', async () => {
    await playPuzzle(BLANK_PUZZLE)
    tapEach(TRIPLE_TAPS.slice(0, 2))
    tap({ r: 0, c: 2 }, SLOW_TAP_MS)

    expect(get(game).errorCells).toEqual(TRIPLE_CELLS)

    tap({ r: 0, c: 2 })

    expect(get(game).errorCells.size).toBe(0)
    expect(get(game).mistakeCount).toBe(0)
  })

  it.each(TAP_SPEEDS_MS)(
    'counts a triple left behind, then five taps elsewhere, as one mistake at %i ms per tap',
    async (pauseMs) => {
      await playPuzzle(BLANK_PUZZLE)
      tapEach(TRIPLE_TAPS, pauseMs)
      tapEach(FIVE_TAPS_ELSEWHERE, pauseMs)

      expect(get(game).mistakeCount).toBe(1)
    }
  )

  it.each(TRIPLE_TAPS)('reads Clean when the next tap, on ($r, $c), fixes a triple', async (cell) => {
    await playPuzzle(BLANK_PUZZLE)
    tapEach(TRIPLE_TAPS)
    tap(cell)
    finishFlawlessly(FAST_TAP_MS)

    const state = get(game)
    expect(state.status).toBe('solved')
    expect(deriveSolveQuality(state)).toBe('clean')
  })

  it('never charges for time alone, even once the preview shows', async () => {
    await playPuzzle(BLANK_PUZZLE)
    tapEach(TRIPLE_TAPS)
    vi.advanceTimersByTime(LONG_PAUSE_MS)

    expect(get(game).errorCells).toEqual(TRIPLE_CELLS)
    expect(get(game).mistakeCount).toBe(0)
  })

  it('shows a charged ✕ from the tap that leaves the violation until a tap fixes it', async () => {
    await playPuzzle(BLANK_PUZZLE)
    tapEach(TRIPLE_TAPS)
    tap({ r: 5, c: 5 })

    expect(get(game).errorCells).toEqual(TRIPLE_CELLS)

    tap({ r: 4, c: 4 })
    vi.advanceTimersByTime(LONG_PAUSE_MS)

    expect(get(game).errorCells).toEqual(TRIPLE_CELLS)

    tap({ r: 0, c: 1 })

    expect(get(game).errorCells.size).toBe(0)
    expect(get(game).mistakeCount).toBe(1)
  })

  it('keeps a charged ✕ and its mistake through an undo that leaves the violation standing', async () => {
    await playPuzzle(BLANK_PUZZLE)
    tapEach(TRIPLE_TAPS)
    tap({ r: 5, c: 5 })
    undo()

    expect(get(game).errorCells).toEqual(TRIPLE_CELLS)
    expect(get(game).mistakeCount).toBe(1)
  })

  it('sends the scoring version with the solve, so stored labels never mix rules', async () => {
    const fetchMock = await playPuzzle(BLANK_PUZZLE)
    finishFlawlessly(FAST_TAP_MS)
    await autosubmitIfSolved()

    const [, submit] = fetchMock.mock.calls.find(([url]) => url === '/api/submit') ?? []
    expect(JSON.parse(String(submit?.body))).toMatchObject({
      mistakeCount: 0,
      scoringVersion: SCORING_VERSION,
    })
  })
})
