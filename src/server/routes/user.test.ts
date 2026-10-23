import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import { stampPost } from '../core/puzzle-number'
import {
  hoursAfterPost,
  postedAt,
  postNumbers,
  readCalendarStreak,
  saveCalendarStreak,
  type CalendarCounters,
} from '../test-helpers/numbered-posts'
import app from './index'

const PLAYER = 't2_user_456'
const OTHER_POST = 't3_post_123'
const PUZZLE_STATE_KEY = `user:${PLAYER}:streak:puzzle`

type StreakBody = Record<string, unknown>

const getStreak = async (): Promise<StreakBody> => {
  const response = await app.fetch(new Request('http://localhost/api/streak'))
  expect(response.status).toBe(200)
  return (await response.json()) as StreakBody
}

const useSettings = (values: Record<string, string[] | number>) => {
  fake.settings.getAll.mockResolvedValue(values)
}

const stored = (overrides: Partial<CalendarCounters>): CalendarCounters => ({
  current: 12,
  longest: 20,
  lastDate: '2026-10-21',
  freezes: 1,
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  fake.redis.__clearStore()
  Object.assign(fake.context, { postId: OTHER_POST, userId: PLAYER })
  vi.useFakeTimers({ toFake: ['Date'] })
  // Thursday 2026-10-22 at 12:00 UTC, 4 hours after #128 posted.
  vi.setSystemTime(hoursAfterPost(128, 4))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/streak under the calendar rule', () => {
  it('returns the stored counters exactly as today, and seeds nothing', async () => {
    useSettings({ streakRule: ['calendar'] })
    await saveCalendarStreak(PLAYER, stored({ current: 5, longest: 9, lastDate: '2026-10-12' }))

    expect(await getStreak()).toEqual({
      currentStreak: 5,
      longestStreak: 9,
      lastPlayedDate: '2026-10-12',
      todayCompleted: false,
    })
    expect(await fake.redis.hGetAll(PUZZLE_STATE_KEY)).toEqual({})
  })

  it('answers zeros for a logged-out player', async () => {
    useSettings({ streakRule: ['calendar'] })
    Object.assign(fake.context, { userId: undefined })

    expect(await getStreak()).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedDate: null,
      todayCompleted: false,
    })
  })
})

describe('GET /api/streak seeding under the puzzle rule', () => {
  it.each([
    ['solved today', stored({ lastDate: '2026-10-22' }), 127, 1],
    ['solved yesterday', stored({ lastDate: '2026-10-21' }), 127, 1],
    ["solved two days ago, with yesterday's #127 still open", stored({ lastDate: '2026-10-20', freezes: 0 }), 127, 0],
    ['solved two days ago, before the first numbered post', stored({ lastDate: '2026-10-20' }), 128, 0],
  ])(
    'computes the stored streak right after seeding a player who %s',
    async (_case, counters, firstPosted, freezesAfterSeeding) => {
      await postNumbers(firstPosted, 128)
      await saveCalendarStreak(PLAYER, counters)

      expect(await getStreak()).toMatchObject({
        currentStreak: counters.current,
        longestStreak: counters.longest,
        rule: 'puzzle',
        freezes: freezesAfterSeeding,
      })
      expect(await readCalendarStreak(PLAYER)).toEqual({
        current: `${counters.current}`,
        longest: `${counters.longest}`,
        lastDate: counters.lastDate,
        freezes: `${counters.freezes}`,
        board: null,
      })
    }
  )

  it('shows the stored counters, not a reset streak, when the puzzle streak fails', async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(PLAYER, stored({}))
    fake.redis.zRange.mockRejectedValueOnce(new Error('Redis unavailable'))

    expect(await getStreak()).toEqual({
      currentStreak: 12,
      longestStreak: 20,
      lastPlayedDate: '2026-10-21',
      todayCompleted: false,
    })
  })

  it("carries nothing over from a streak today's rule already ended, and keeps its best", async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(PLAYER, stored({ current: 7, longest: 12, lastDate: '2026-10-12' }))

    expect(await getStreak()).toMatchObject({ currentStreak: 0, longestStreak: 12 })
  })

  it('seeds once, so later changes to the old counters leave the puzzle streak alone', async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(PLAYER, stored({}))
    const first = await getStreak()
    const seeded = await fake.redis.hGetAll(PUZZLE_STATE_KEY)

    await saveCalendarStreak(PLAYER, stored({ current: 40, longest: 40, freezes: 2 }))

    expect(await getStreak()).toEqual(first)
    expect(await fake.redis.hGetAll(PUZZLE_STATE_KEY)).toEqual(seeded)
  })
})

describe('GET /api/streak when the rule flips', () => {
  it('reads each rule on the next request, in both directions, without losing either', async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(PLAYER, stored({ current: 5, longest: 9, lastDate: '2026-10-12' }))
    const calendarBefore = await readCalendarStreak(PLAYER)

    useSettings({ streakRule: ['puzzle'] })
    expect(await getStreak()).toMatchObject({ currentStreak: 0, longestStreak: 9, rule: 'puzzle' })
    const seeded = await fake.redis.hGetAll(PUZZLE_STATE_KEY)

    useSettings({ streakRule: ['calendar'] })
    expect(await getStreak()).toEqual({
      currentStreak: 5,
      longestStreak: 9,
      lastPlayedDate: '2026-10-12',
      todayCompleted: false,
    })

    useSettings({ streakRule: ['puzzle'] })
    expect(await getStreak()).toMatchObject({ currentStreak: 0, longestStreak: 9, rule: 'puzzle' })

    expect(await readCalendarStreak(PLAYER)).toEqual(calendarBefore)
    expect(await fake.redis.hGetAll(PUZZLE_STATE_KEY)).toEqual(seeded)
  })
})

describe('GET /api/streak still counts', () => {
  beforeEach(async () => {
    await postNumbers(127, 128)
    await saveCalendarStreak(PLAYER, stored({ current: 6, lastDate: '2026-10-20', freezes: 0 }))
  })

  it("points to #127 while it is unsolved and its window is open", async () => {
    expect(await getStreak()).toMatchObject({
      currentStreak: 6,
      stillCounts: { number: 127, postId: 't3_post127', closesAt: '2026-10-22T20:00:00.000Z' },
    })
  })

  it("points nowhere on a post stamped #127, since the player is already there", async () => {
    await stampPost('t3_menu127', 127, postedAt(127))
    Object.assign(fake.context, { postId: 't3_menu127' })

    expect(await getStreak()).toMatchObject({ currentStreak: 6, stillCounts: null })
  })

  it('points nowhere once the window closes, and says which run ended', async () => {
    await getStreak()
    vi.setSystemTime(hoursAfterPost(127, 37))

    expect(await getStreak()).toMatchObject({
      currentStreak: 0,
      longestStreak: 20,
      endedRun: 6,
      stillCounts: null,
    })
  })

  it('shows no pointer under the calendar rule', async () => {
    useSettings({ streakRule: ['calendar'] })

    expect(await getStreak()).not.toHaveProperty('stillCounts')
  })
})
