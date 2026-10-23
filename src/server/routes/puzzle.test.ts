import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import { redis } from '@devvit/web/server'
import { solvePuzzle } from '../../shared/solver'
import type { PuzzleWithGrid } from '../../shared/types/puzzle'
import { generateDailyPuzzle } from '../core/generator'
import { FAKE_POST_ID, FAKE_USER_ID } from '../test-helpers/devvit-fake'
import app from './index'

const DAY_ONE = new Date('2026-10-22T12:00:00Z')
const DAY_TWO = new Date('2026-10-23T12:00:00Z')
const TIER = 'hard'
const STORED_KEY = `post:${FAKE_POST_ID}:puzzle:${TIER}`
const ATTEMPT_ID = '3d6f0a9c-8e21-4b57-b0c4-5f1e7a2d9c63'
// Every saved solve stamps the player's streak date; a month-old one is still a returning player.
const LAST_SOLVE_KEY = `user:${FAKE_USER_ID}:streak:lastDate`
const LAST_SOLVE_DATE = '2026-09-22'

type PuzzleReply = { puzzle: PuzzleWithGrid; firstScreen: boolean }

const requestPuzzle = (query = '') => app.fetch(new Request(`http://localhost/api/puzzle${query}`))

const loadPuzzle = async (query = ''): Promise<PuzzleReply> =>
  (await (await requestPuzzle(query)).json()) as PuzzleReply

const getPuzzle = async (query = `difficulty=${TIER}`): Promise<PuzzleWithGrid> =>
  (await loadPuzzle(`?${query}`)).puzzle

const switchFirstScreen = (firstScreen: boolean) => fake.setSettings({ firstScreen })

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
  fake.reset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DAY_ONE)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/puzzle without a tier', () => {
  it('starts a logged-out player on Easy', async () => {
    fake.context.userId = undefined

    const { puzzle } = await loadPuzzle()

    expect(puzzle.difficulty).toBe('easy')
    expect(puzzle.id).toBe(`${FAKE_POST_ID}:easy`)
  })

  it('starts a logged-in player who has never solved on Easy', async () => {
    const { puzzle } = await loadPuzzle()

    expect(puzzle.difficulty).toBe('easy')
  })

  it('starts a player who has solved before on Medium', async () => {
    await redis.set(LAST_SOLVE_KEY, LAST_SOLVE_DATE)

    const { puzzle } = await loadPuzzle()

    expect(puzzle.difficulty).toBe('medium')
    expect(puzzle.id).toBe(`${FAKE_POST_ID}:medium`)
  })

  it('starts everyone on Medium while the first screen is switched off', async () => {
    switchFirstScreen(false)

    const newPlayer = await loadPuzzle()
    fake.context.userId = undefined
    const loggedOut = await loadPuzzle()

    expect(newPlayer.puzzle.difficulty).toBe('medium')
    expect(loggedOut.puzzle.difficulty).toBe('medium')
  })

  it('still loads, with the first screen on, when the settings read fails', async () => {
    fake.settings.getAll.mockRejectedValue(new Error('Could not get installation settings'))

    const response = await requestPuzzle()
    const { puzzle, firstScreen } = (await response.json()) as PuzzleReply

    expect(response.status).toBe(200)
    expect(puzzle.difficulty).toBe('easy')
    expect(firstScreen).toBe(true)
  })
})

describe('GET /api/puzzle with a tier', () => {
  it('serves the requested tier to a player who has never solved', async () => {
    const { puzzle } = await loadPuzzle(`?difficulty=${TIER}`)

    expect(puzzle.difficulty).toBe(TIER)
  })

  it('serves the requested tier to a returning player', async () => {
    await redis.set(LAST_SOLVE_KEY, LAST_SOLVE_DATE)

    const { puzzle } = await loadPuzzle('?difficulty=easy')

    expect(puzzle.difficulty).toBe('easy')
  })
})

describe('GET /api/puzzle and the first-screen switch', () => {
  it('says the first screen is on by default', async () => {
    expect((await loadPuzzle()).firstScreen).toBe(true)
    expect((await loadPuzzle(`?difficulty=${TIER}`)).firstScreen).toBe(true)
  })

  it('says when a moderator has switched it off', async () => {
    switchFirstScreen(false)

    expect((await loadPuzzle()).firstScreen).toBe(false)
    expect((await loadPuzzle(`?difficulty=${TIER}`)).firstScreen).toBe(false)
  })
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
    fake.context.postId = undefined
    const before = fake.snapshot()

    const puzzle = await getPuzzle()

    expect(puzzle.id).toBe(`2026-10-22:${TIER}`)
    expect(fake.snapshot()).toBe(before)
  })
})
