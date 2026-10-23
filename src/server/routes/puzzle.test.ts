import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('../test-helpers/devvit-server-fake')).devvitServerFake.module
)

import { redis } from '@devvit/web/server'
import { solvePuzzle } from '../../shared/solver'
import type { PuzzleWithGrid } from '../../shared/types/puzzle'
import { generateDailyPuzzle } from '../core/generator'
import { devvitServerFake, FAKE_POST_ID } from '../test-helpers/devvit-server-fake'
import app from './index'

const DAY_ONE = new Date('2026-10-22T12:00:00Z')
const DAY_TWO = new Date('2026-10-23T12:00:00Z')
const TIER = 'hard'
const STORED_KEY = `post:${FAKE_POST_ID}:puzzle:${TIER}`
const ATTEMPT_ID = '3d6f0a9c-8e21-4b57-b0c4-5f1e7a2d9c63'

const getPuzzle = async (query = `difficulty=${TIER}`): Promise<PuzzleWithGrid> => {
  const response = await app.fetch(new Request(`http://localhost/api/puzzle?${query}`))
  return ((await response.json()) as { puzzle: PuzzleWithGrid }).puzzle
}

const submitSolution = (puzzle: PuzzleWithGrid) =>
  app.fetch(
    new Request('http://localhost/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: puzzle.id,
        attemptId: ATTEMPT_ID,
        grid: solvePuzzle(puzzle.initial, puzzle.fixed),
        solveTimeSeconds: 140,
        hintsUsed: 0,
        mistakeCount: 0,
        undoCount: 0,
      }),
    })
  )

const asStoredHash = (puzzle: PuzzleWithGrid) => ({
  id: puzzle.id,
  size: `${puzzle.size}`,
  difficulty: puzzle.difficulty,
  fixed: JSON.stringify(puzzle.fixed),
  initial: JSON.stringify(puzzle.initial),
})

beforeEach(() => {
  devvitServerFake.reset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DAY_ONE)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/puzzle on a post without stored puzzles', () => {
  it('stores the served puzzle under the post with a post-scoped ID', async () => {
    const puzzle = await getPuzzle()

    expect(puzzle.id).toBe(`${FAKE_POST_ID}:${TIER}`)
    expect(await redis.hGetAll(STORED_KEY)).toEqual(asStoredHash(puzzle))
  })

  it('lets /api/submit accept a solve of the served puzzle', async () => {
    const puzzle = await getPuzzle()

    const response = await submitSolution(puzzle)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  })

  it('keeps serving the stored puzzle on later days', async () => {
    const first = await getPuzzle()
    vi.setSystemTime(DAY_TWO)

    expect(await getPuzzle()).toEqual(first)
  })

  it("stores today's puzzle even when the request names another date", async () => {
    const puzzle = await getPuzzle(`difficulty=${TIER}&date=2020-01-01`)

    expect(puzzle.fixed).toEqual(generateDailyPuzzle('2026-10-22', TIER).fixed)
    expect(await redis.hGetAll(STORED_KEY)).toEqual(asStoredHash(puzzle))
  })
})

describe('GET /api/puzzle elsewhere', () => {
  it('serves a stored post puzzle unchanged', async () => {
    const stored = { ...generateDailyPuzzle('2026-01-05', TIER), id: `${FAKE_POST_ID}:${TIER}` }
    await redis.hSet(STORED_KEY, asStoredHash(stored))

    expect(await getPuzzle()).toEqual(stored)
    expect(await redis.hGetAll(STORED_KEY)).toEqual(asStoredHash(stored))
  })

  it('serves the date puzzle and stores nothing outside a post', async () => {
    devvitServerFake.module.context.postId = undefined
    const before = devvitServerFake.snapshot()

    const puzzle = await getPuzzle()

    expect(puzzle.id).toBe(`2026-10-22:${TIER}`)
    expect(devvitServerFake.snapshot()).toBe(before)
  })
})
