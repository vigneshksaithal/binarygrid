import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import { redis } from '@devvit/web/server'
import { getUTCWeekId } from '../../shared/growth'
import { solvePuzzle } from '../../shared/solver'
import { LOGIN_REQUIRED_CODE } from '../../shared/submit'
import { generateDailyPuzzle } from '../core/generator'
import { stampPost } from '../core/puzzle-number'
import { SUBMIT_CLAIM_LEASE_MS } from '../lib/submit-attempts'
import { FAKE_POST_ID, FAKE_USER_ID } from '../test-helpers/devvit-fake'
import {
  hoursAfterPost,
  postIdOf,
  postNumbers,
  readCalendarStreak,
  saveCalendarStreak,
  type CalendarCounters,
} from '../test-helpers/numbered-posts'
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

const storePostPuzzle = (postId = FAKE_POST_ID) =>
  redis.hSet(`post:${postId}:puzzle:${TIER}`, {
    id: `${postId}:${TIER}`,
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

const ECONOMY_KEY = `user:${FAKE_USER_ID}:economy`
const SAVED_ECONOMY = JSON.stringify({
  coins: 340,
  totalCoins: 1290,
  totalSolves: 61,
  speedSolves: 12,
  equippedTitle: 'grid_master',
  ownedTitles: ['puzzler', 'grid_master'],
  dailyFirstSolve: '2026-10-21',
})

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
  fake.reddit.getCurrentUser.mockReturnValueOnce(lookup)
  const first = submit(solveBody())
  await vi.waitFor(() => expect(fake.reddit.getCurrentUser).toHaveBeenCalled())
  return { first }
}

beforeEach(async () => {
  fake.reset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOON)
  await storePostPuzzle()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/submit idempotency', () => {
  it('answers a repeated attempt ID with the stored response and changes nothing', async () => {
    const first = await (await submit(solveBody())).json()
    const before = fake.snapshot()

    const repeat = await submit(solveBody({ solveTimeSeconds: 40 }))

    expect(repeat.status).toBe(200)
    expect(await repeat.json()).toEqual(first)
    expect(fake.snapshot()).toBe(before)
  })

  it('leaves one board entry, attempt, weekly entry and submit_success when a failed submit is retried', async () => {
    fake.redis.zScore.mockRejectedValueOnce(new Error('Redis unavailable'))
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
    const zAdd = fake.redis.zAdd.getMockImplementation()
    if (!zAdd) throw new Error('The fake has no zAdd')
    fake.redis.zAdd.mockImplementation(async (key, ...members) => {
      if (key.startsWith('leaderboard:weekly:')) throw new Error('Redis unavailable')
      return zAdd(key, ...members)
    })
    const failed = await submit(solveBody())
    fake.redis.zAdd.mockImplementation(zAdd)
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
    const before = fake.snapshot()

    const midSave = await submit(solveBody())
    expect(midSave.status).toBe(409)
    expect(fake.snapshot()).toBe(before)

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

    expect(fake.ttlOf(`submit:attempt:${PUZZLE_ID}:${FAKE_USER_ID}`)).toBe(
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
    const before = fake.snapshot()

    const response = await submit(solveBody({ attemptId }))

    expect(response.status).toBe(400)
    expect(await response.json()).not.toHaveProperty('code')
    expect(fake.snapshot()).toBe(before)
  })
})

describe('POST /api/submit with coins retired', () => {
  it('answers a solve without a coin reward', async () => {
    const response = await submit(solveBody())

    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('coinReward')
  })

  it('writes no coins board, coin ledger or weekly league entry', async () => {
    await submit(solveBody())

    const stored = fake.snapshot()
    expect(stored).not.toContain('leaderboard:coins')
    expect(stored).not.toContain('economy:ledger:')
    expect(stored).not.toContain(':league-')
  })

  it('leaves a saved balance and titles exactly as they were', async () => {
    await redis.hSet(ECONOMY_KEY, { economy: SAVED_ECONOMY })

    await submit(solveBody())

    expect(await redis.hGetAll(ECONOMY_KEY)).toEqual({ economy: SAVED_ECONOMY })
  })

  it('starts no coin record for a player who never had one', async () => {
    await submit(solveBody())

    expect(await redis.hGetAll(ECONOMY_KEY)).toEqual({})
  })
})

type StreakResponse = Record<string, unknown>

const STREAK_LOG_KEY = `user:${FAKE_USER_ID}:streak:log`

const calendar = (overrides: Partial<CalendarCounters> = {}): CalendarCounters => ({
  current: 4,
  longest: 4,
  lastDate: '2026-10-21',
  freezes: 0,
  ...overrides,
})

/** Solves the easy tier on a post, as a fresh attempt, and returns the response's streak. */
const solveOn = async (postId: string): Promise<StreakResponse> => {
  fake.context.postId = postId
  await storePostPuzzle(postId)
  const response = await submit(
    solveBody({ id: `${postId}:${TIER}`, attemptId: crypto.randomUUID() })
  )
  expect(response.status).toBe(200)
  return ((await response.json()) as { streak: StreakResponse }).streak
}

const readStreak = async (): Promise<StreakResponse> =>
  (await app.fetch(new Request('http://localhost/api/streak'))).json()

const useRule = (streakRule: 'puzzle' | 'calendar') =>
  fake.setSettings({ streakRule: [streakRule] })

describe('POST /api/submit streaks: both rules are kept up to date', () => {
  it.each(['puzzle', 'calendar'] as const)(
    'updates the calendar counters and board exactly as before under the %s rule',
    async (rule) => {
      useRule(rule)
      await postNumbers(127, 128)
      await saveCalendarStreak(FAKE_USER_ID, calendar())

      await solveOn(postIdOf(128))

      expect(await readCalendarStreak(FAKE_USER_ID)).toEqual({
        current: '5',
        longest: '5',
        lastDate: '2026-10-22',
        freezes: '1',
        board: 5,
      })
    }
  )

  it("answers with today's calendar values under the calendar rule", async () => {
    useRule('calendar')
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar())

    expect(await solveOn(postIdOf(128))).toEqual({
      currentStreak: 5,
      longestStreak: 5,
      todayCompleted: true,
      freezes: 1,
      earnedFreeze: true,
      savedByFreeze: false,
    })
  })

  it('answers with the puzzle streak, seeded from the counters before they changed', async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar())

    expect(await solveOn(postIdOf(128))).toMatchObject({
      currentStreak: 5,
      longestStreak: 5,
      todayCompleted: true,
      rule: 'puzzle',
      freezes: 1,
      earnedFreeze: true,
      covered: [],
      endedRun: 0,
    })
  })

  it("doesn't count today twice when the calendar rule already had today's solve", async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar({ current: 5, longest: 5, lastDate: '2026-10-22' }))

    expect(await solveOn(postIdOf(128))).toMatchObject({ currentStreak: 5, rule: 'puzzle' })
    expect((await readCalendarStreak(FAKE_USER_ID)).current).toBe('5')
  })

  it('keeps crediting under the calendar rule, so flipping to puzzle later shows the solve', async () => {
    useRule('calendar')
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar({ lastDate: '2026-10-20', freezes: 1 }))
    await solveOn(postIdOf(128))

    // The calendar rule spent its freeze on Wednesday; #127 is still open, so the
    // puzzle rule kept its own and earned one at 5.
    useRule('puzzle')
    expect(await readStreak()).toMatchObject({ currentStreak: 5, freezes: 2, rule: 'puzzle' })

    useRule('calendar')
    expect(await readStreak()).toEqual({
      currentStreak: 5,
      longestStreak: 5,
      lastPlayedDate: '2026-10-22',
      todayCompleted: true,
    })
  })
})

describe('POST /api/submit streaks: credit by puzzle', () => {
  it('credits a solve 35 hours after #N posted but not 37 hours after, and a 48-hour window changes that', async () => {
    await postNumbers(127, 128)

    vi.setSystemTime(hoursAfterPost(127, 35))
    await solveOn(postIdOf(127))
    expect(await readStreak()).toMatchObject({ currentStreak: 1 })

    fake.context.userId = 't2_late_solver'
    vi.setSystemTime(hoursAfterPost(127, 37))
    await solveOn(postIdOf(127))
    expect(await readStreak()).toMatchObject({ currentStreak: 0 })

    fake.setSettings({ streakWindowHours: 48 })
    expect(await readStreak()).toMatchObject({ currentStreak: 1 })
  })

  it("credits any post stamped #N, timing the window from #N's indexed post", async () => {
    await postNumbers(127, 128)
    await stampPost(FAKE_POST_ID, 127, hoursAfterPost(127, 4))

    vi.setSystemTime(hoursAfterPost(127, 35))
    await solveOn(FAKE_POST_ID)
    expect(await readStreak()).toMatchObject({ currentStreak: 1 })

    fake.context.userId = 't2_late_solver'
    vi.setSystemTime(hoursAfterPost(127, 37))
    await solveOn(FAKE_POST_ID)
    expect(await readStreak()).toMatchObject({ currentStreak: 0 })
  })

  it('credits each number once, from the first solve, however many posts or replays follow', async () => {
    await postNumbers(127, 128)
    await stampPost(FAKE_POST_ID, 128, hoursAfterPost(128, 2))

    await solveOn(postIdOf(128))
    vi.setSystemTime(hoursAfterPost(128, 10))
    await solveOn(FAKE_POST_ID)
    await solveOn(postIdOf(128))

    expect(await redis.zScore(STREAK_LOG_KEY, '128')).toBe(4 * 60 * 60)
    expect(await readStreak()).toMatchObject({ currentStreak: 1 })
  })

  it("doesn't credit a post that was never numbered", async () => {
    await postNumbers(127, 128)

    expect(await solveOn(FAKE_POST_ID)).toMatchObject({ currentStreak: 0, rule: 'puzzle' })
    expect(await redis.zCard(STREAK_LOG_KEY)).toBe(0)
  })

  it('keeps the streak and spends no freeze when #128 is solved before #127', async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar({ current: 6, longest: 6, lastDate: '2026-10-20', freezes: 1 }))

    expect(await solveOn(postIdOf(128))).toMatchObject({ currentStreak: 7, freezes: 1, covered: [] })
    vi.setSystemTime(hoursAfterPost(127, 29))
    expect(await solveOn(postIdOf(127))).toMatchObject({ currentStreak: 8, freezes: 1, covered: [] })
  })

  it('skips a number whose date stored no puzzles instead of breaking the streak', async () => {
    await postNumbers(127, 128, [127])
    await saveCalendarStreak(FAKE_USER_ID, calendar({ current: 6, longest: 6, lastDate: '2026-10-20' }))
    vi.setSystemTime(hoursAfterPost(127, 37))

    expect(await solveOn(postIdOf(128))).toMatchObject({ currentStreak: 7, covered: [] })
  })
})

describe('POST /api/submit streaks: freezes', () => {
  it('reports the number a freeze covered on the solve that spent it, and only then', async () => {
    await postNumbers(126, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar({ current: 6, longest: 6, lastDate: '2026-10-19', freezes: 1 }))

    expect(await solveOn(postIdOf(128))).toMatchObject({
      currentStreak: 7,
      freezes: 0,
      covered: [{ number: 126, date: '2026-10-20' }],
    })
    vi.setSystemTime(hoursAfterPost(127, 29))
    expect(await solveOn(postIdOf(127))).toMatchObject({ currentStreak: 8, covered: [] })
    expect(await readStreak()).toMatchObject({ currentStreak: 8, covered: [] })
  })

  it.each([
    [2, 7, [{ number: 125, date: '2026-10-19' }, { number: 126, date: '2026-10-20' }]],
    [1, 1, []],
  ])('with %i freezes, two missed numbers leave a streak of %i', async (freezes, currentStreak, covered) => {
    await postNumbers(125, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar({ current: 6, longest: 6, lastDate: '2026-10-18', freezes }))

    expect(await solveOn(postIdOf(128))).toMatchObject({ currentStreak, covered })
  })
})

describe('POST /api/submit streaks: the puzzle rule never rejects a solve', () => {
  it("answers with today's values when the puzzle streak fails", async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar())
    const zAdd = fake.redis.zAdd.getMockImplementation()
    if (!zAdd) throw new Error('The fake has no zAdd')
    fake.redis.zAdd.mockImplementation(async (key, ...members) => {
      if (key === STREAK_LOG_KEY) throw new Error('Redis unavailable')
      return zAdd(key, ...members)
    })

    const streak = await solveOn(postIdOf(128))

    expect(streak).toMatchObject({ currentStreak: 5, savedByFreeze: false })
    expect(streak).not.toHaveProperty('rule')
    expect((await readCalendarStreak(FAKE_USER_ID)).current).toBe('5')
  })

  it("answers with today's values when settings can't be read, and still credits the solve", async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(FAKE_USER_ID, calendar({ freezes: 1 }))
    fake.settings.getAll.mockRejectedValueOnce(new Error('Could not get installation settings'))

    expect(await solveOn(postIdOf(128))).not.toHaveProperty('rule')
    expect(await redis.zScore(STREAK_LOG_KEY, '128')).toBe(4 * 60 * 60)

    // Seeding waits for a known window, so the next read seeds from the counters
    // today's block just updated (5, with a freeze earned), and #128 counts once.
    expect(await readStreak()).toMatchObject({ currentStreak: 5, freezes: 2, rule: 'puzzle' })
  })
})

describe('POST /api/submit for logged-out players', () => {
  it('returns 401 with the login code and stores nothing', async () => {
    fake.context.userId = undefined
    const before = fake.snapshot()

    const response = await submit(solveBody())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: LOGIN_REQUIRED_CODE })
    expect(fake.snapshot()).toBe(before)
  })
})
