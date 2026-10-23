import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('../test-helpers/devvit-server-fake')).devvitServerFake.module
)

import { reddit, redis } from '@devvit/web/server'
import { getUTCWeekId } from '../../shared/growth'
import { solvePuzzle } from '../../shared/solver'
import { LOGIN_REQUIRED_CODE } from '../../shared/submit'
import { generateDailyPuzzle } from '../core/generator'
import { SUBMIT_CLAIM_LEASE_MS } from '../lib/submit-attempts'
import { devvitServerFake, FAKE_POST_ID, FAKE_USER_ID } from '../test-helpers/devvit-server-fake'
import app from './index'

const NOON = new Date('2026-10-22T12:00:00Z')
const TODAY = '2026-10-22'
const TIER = 'easy'
const PUZZLE_ID = `${FAKE_POST_ID}:${TIER}`
const ATTEMPT_ID = '0f8c2b7e-5d1a-4c3e-9b6f-2a7d4e1c8b90'
const NEXT_ATTEMPT_ID = '7c41d9a2-3b8e-4f60-a1d5-9e2b6c0f4a17'
const FORTY_EIGHT_HOURS_IN_SECONDS = 48 * 60 * 60

const puzzle = generateDailyPuzzle(TODAY, TIER)
const solution = solvePuzzle(puzzle.initial, puzzle.fixed)

const storePostPuzzle = () =>
  redis.hSet(`post:${FAKE_POST_ID}:puzzle:${TIER}`, {
    id: PUZZLE_ID,
    size: '6',
    difficulty: TIER,
    fixed: JSON.stringify(puzzle.fixed),
    initial: JSON.stringify(puzzle.initial),
  })

const solveBody = (overrides: Record<string, unknown> = {}) => ({
  id: PUZZLE_ID,
  attemptId: ATTEMPT_ID,
  grid: solution,
  solveTimeSeconds: 95,
  hintsUsed: 0,
  mistakeCount: 0,
  undoCount: 0,
  ...overrides,
})

const submit = (body: unknown) =>
  app.fetch(
    new Request('http://localhost/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

const boardEntries = () => redis.zCard(`leaderboard:${PUZZLE_ID}`)

const attemptsRecorded = async (): Promise<number> => {
  const meta = await redis.hGet(`leaderboard:${PUZZLE_ID}:meta`, FAKE_USER_ID)
  return meta ? (JSON.parse(meta) as { attempts: number }).attempts : 0
}

const submitSuccessCount = async (): Promise<number> =>
  Number((await redis.get(`daily:${TODAY}:events:submit_success`)) ?? 0)

const weeklyEntries = () => redis.zCard(`leaderboard:weekly:${getUTCWeekId()}:${TIER}`)

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

// Holds the first submit just after it claims its attempt, at the username lookup.
// The pending response comes back wrapped, so awaiting this never waits for it.
const holdFirstSubmitMidSave = async (lookup: Promise<{ username: string }>) => {
  vi.spyOn(reddit, 'getCurrentUser').mockReturnValueOnce(lookup)
  const first = submit(solveBody())
  await vi.waitFor(() => expect(reddit.getCurrentUser).toHaveBeenCalled())
  return { first }
}

beforeEach(async () => {
  devvitServerFake.reset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOON)
  await storePostPuzzle()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('POST /api/submit idempotency', () => {
  it('answers a repeated attempt ID with the stored response and changes nothing', async () => {
    const first = await (await submit(solveBody())).json()
    const before = devvitServerFake.snapshot()

    const repeat = await submit(solveBody({ solveTimeSeconds: 40 }))

    expect(repeat.status).toBe(200)
    expect(await repeat.json()).toEqual(first)
    expect(devvitServerFake.snapshot()).toBe(before)
  })

  it('leaves one board entry, attempt, weekly entry and submit_success when a failed submit is retried', async () => {
    vi.spyOn(redis, 'zScore').mockRejectedValueOnce(new Error('Redis unavailable'))
    const failed = await submit(solveBody())
    const retried = await submit(solveBody())

    expect(failed.status).toBe(400)
    expect(retried.status).toBe(200)
    expect(await boardEntries()).toBe(1)
    expect(await attemptsRecorded()).toBe(1)
    expect(await weeklyEntries()).toBe(1)
    expect(await submitSuccessCount()).toBe(1)
  })

  it('keeps one of each when a save that failed after the board write is retried', async () => {
    const zAdd = redis.zAdd
    vi.spyOn(redis, 'zAdd').mockImplementation(async (key, ...members) => {
      if (key.startsWith('leaderboard:weekly:')) throw new Error('Redis unavailable')
      return zAdd(key, ...members)
    })
    const failed = await submit(solveBody())
    vi.restoreAllMocks()
    const retried = await submit(solveBody())

    expect(failed.status).toBe(400)
    expect(retried.status).toBe(200)
    expect(await boardEntries()).toBe(1)
    expect(await attemptsRecorded()).toBe(1)
    expect(await weeklyEntries()).toBe(1)
    expect(await submitSuccessCount()).toBe(1)
  })

  it('answers a retry that arrives mid-save with 409, then with the saved response', async () => {
    const lookup = deferred<{ username: string }>()
    const { first } = await holdFirstSubmitMidSave(lookup.promise)
    const before = devvitServerFake.snapshot()

    const midSave = await submit(solveBody())
    expect(midSave.status).toBe(409)
    expect(devvitServerFake.snapshot()).toBe(before)

    lookup.resolve({ username: 'fake_solver' })
    const saved = await (await first).json()
    const later = await submit(solveBody())
    expect(await later.json()).toEqual(saved)
    expect(await attemptsRecorded()).toBe(1)
  })

  it('takes over a save abandoned for longer than a request can run', async () => {
    await holdFirstSubmitMidSave(new Promise(() => {}))
    vi.setSystemTime(Date.now() + SUBMIT_CLAIM_LEASE_MS + 1)

    const retry = await submit(solveBody())

    expect(retry.status).toBe(200)
    expect(await boardEntries()).toBe(1)
    expect(await attemptsRecorded()).toBe(1)
  })

  it('counts a new attempt on the same puzzle, as replays did before', async () => {
    await submit(solveBody())
    await submit(solveBody({ attemptId: NEXT_ATTEMPT_ID, solveTimeSeconds: 80 }))

    expect(await attemptsRecorded()).toBe(2)
    expect(await redis.zScore(`leaderboard:${PUZZLE_ID}`, FAKE_USER_ID)).toBe(80)
  })

  it('keeps the attempt record for 48 hours', async () => {
    await submit(solveBody())

    expect(devvitServerFake.ttlOf(`submit:attempt:${PUZZLE_ID}:${FAKE_USER_ID}`)).toBe(
      FORTY_EIGHT_HOURS_IN_SECONDS
    )
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too short', 'abc1234'],
    ['too long', 'a'.repeat(65)],
    ['a key separator', 'attempt:00001'],
    ['a space', 'attempt 00001'],
    ['a number', 12_345_678],
  ])('rejects an attempt ID that is %s before storing anything', async (_label, attemptId) => {
    const before = devvitServerFake.snapshot()

    const response = await submit(solveBody({ attemptId }))

    expect(response.status).toBe(400)
    expect(await response.json()).not.toHaveProperty('code')
    expect(devvitServerFake.snapshot()).toBe(before)
  })
})

describe('POST /api/submit for logged-out players', () => {
  it('returns 401 with the login code and stores nothing', async () => {
    devvitServerFake.module.context.userId = undefined
    const before = devvitServerFake.snapshot()

    const response = await submit(solveBody())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: LOGIN_REQUIRED_CODE })
    expect(devvitServerFake.snapshot()).toBe(before)
  })
})
