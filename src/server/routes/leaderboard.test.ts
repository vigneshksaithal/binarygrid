import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('../test-helpers/devvit-server-fake')).devvitServerFake.module
)

import { redis } from '@devvit/web/server'
import { devvitServerFake, FAKE_POST_ID, FAKE_USER_ID } from '../test-helpers/devvit-server-fake'
import { hoursAfterPost, postNumbers, saveCalendarStreak } from '../test-helpers/numbered-posts'
import app from './index'

const PUZZLE_ID = `${FAKE_POST_ID}:medium`
const TIER_BOARD = `/api/leaderboard?puzzleId=${PUZZLE_ID}&pageSize=10`
const STREAK_BOARD = '/api/leaderboard/streaks'

// The logged-in player bought titles but left the free Puzzler equipped.
const KING = 't2_king'
const COLLECTOR = FAKE_USER_ID
const NEWCOMER = 't2_newcomer'

const BINARY_KING = { emoji: '👑', label: 'Binary King' }
const GRID_MASTER = { emoji: '🏆', label: 'Grid Master' }

type BoardEntry = { userId: string; title: unknown }
type BoardBody = { entries: BoardEntry[]; playerEntry: BoardEntry | null }

const saveTitles = (userId: string, equippedTitle: string, ownedTitles: string[]) =>
  redis.hSet(`user:${userId}:economy`, {
    economy: JSON.stringify({
      coins: 40,
      totalCoins: 900,
      totalSolves: 60,
      speedSolves: 8,
      equippedTitle,
      ownedTitles,
      dailyFirstSolve: '2026-10-21',
    }),
  })

const saveUserMeta = (userId: string) =>
  redis.hSet('user:meta', {
    [userId]: JSON.stringify({ username: userId.slice(3), avatarUrl: null }),
  })

// Seeds a player's puzzle-rule streak from calendar counters through their own
// /api/streak read, the way their first visit after deploy does.
const addPuzzleStreaker = async (userId: string, streak: number, lastDate = '2026-10-21') => {
  await saveCalendarStreak(userId, { current: streak, longest: streak, lastDate, freezes: 0 })
  await saveUserMeta(userId)
  devvitServerFake.module.context.userId = userId
  await app.fetch(new Request('http://localhost/api/streak'))
  devvitServerFake.module.context.userId = FAKE_USER_ID
}

const addTierSolver = async (userId: string, timeSeconds: number) => {
  await redis.zAdd(`leaderboard:${PUZZLE_ID}`, { member: userId, score: timeSeconds })
  await redis.hSet(`leaderboard:${PUZZLE_ID}:meta`, {
    [userId]: JSON.stringify({ username: userId.slice(3), avatarUrl: null, attempts: 1 }),
  })
}

const addStreaker = async (userId: string, streak: number) => {
  await redis.zAdd('leaderboard:streaks', { member: userId, score: streak })
  await saveUserMeta(userId)
}

const getBoard = async (path: string): Promise<BoardBody> => {
  const response = await app.fetch(new Request(`http://localhost${path}`))
  expect(response.status).toBe(200)
  return (await response.json()) as BoardBody
}

const titlesOf = (body: BoardBody) => body.entries.map((entry) => entry.title)

type StreakEntry = { userId: string; streak: number }
type StreakBoardBody = { entries: StreakEntry[]; playerEntry: StreakEntry | null }

const getStreakBoard = async (): Promise<StreakBoardBody> => {
  const response = await app.fetch(new Request(`http://localhost${STREAK_BOARD}`))
  expect(response.status).toBe(200)
  return (await response.json()) as StreakBoardBody
}

const streaksOf = (body: StreakBoardBody) =>
  body.entries.map(({ userId, streak }) => ({ userId, streak }))

beforeEach(async () => {
  devvitServerFake.reset()
  vi.useFakeTimers({ toFake: ['Date'] })
  // Thursday 2026-10-22 at 12:00 UTC: #127 (Wednesday) is still open, #128 posted at 08:00.
  vi.setSystemTime(hoursAfterPost(128, 4))
  await postNumbers(127, 128)
  await saveTitles(KING, 'binary_king', ['puzzler', 'grid_master', 'binary_king'])
  await saveTitles(COLLECTOR, 'puzzler', ['puzzler', 'streak_lord', 'grid_master'])
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('titles on the tier board', () => {
  it("shows each listed player's title, including the player's own entry", async () => {
    await addTierSolver(KING, 80)
    await addTierSolver(COLLECTOR, 95)
    await addTierSolver(NEWCOMER, 120)

    const body = await getBoard(TIER_BOARD)

    expect(titlesOf(body)).toEqual([BINARY_KING, GRID_MASTER, null])
    expect(body.playerEntry?.title).toEqual(GRID_MASTER)
  })

  it('reads titles from the saved record, not from the stale display caches', async () => {
    await redis.set(`user:${KING}:display`, JSON.stringify({ username: 'king', titleEmoji: '🧩' }))
    await redis.set(
      `user:${KING}:display:cache`,
      JSON.stringify({ username: 'king', titleEmoji: '⚡', equippedTitle: 'speed_demon' })
    )
    await addTierSolver(KING, 80)

    expect(titlesOf(await getBoard(TIER_BOARD))).toEqual([BINARY_KING])
  })

  it('shows no title when the saved record is unreadable', async () => {
    await redis.hSet(`user:${KING}:economy`, { economy: '{"equippedTitle":' })
    await addTierSolver(KING, 80)

    expect(titlesOf(await getBoard(TIER_BOARD))).toEqual([null])
  })
})

describe('titles on the streak board', () => {
  it("shows each listed player's title, including the player's own entry, under the calendar rule", async () => {
    devvitServerFake.setSettings({ streakRule: ['calendar'] })
    await addStreaker(KING, 30)
    await addStreaker(COLLECTOR, 12)
    await addStreaker(NEWCOMER, 3)

    const body = await getBoard(STREAK_BOARD)

    expect(titlesOf(body)).toEqual([BINARY_KING, GRID_MASTER, null])
    expect(body.playerEntry?.title).toEqual(GRID_MASTER)
  })

  it("shows each listed player's title, including the player's own entry, under the puzzle rule", async () => {
    await addPuzzleStreaker(KING, 30)
    await addPuzzleStreaker(COLLECTOR, 12)
    await addPuzzleStreaker(NEWCOMER, 3)

    const body = await getBoard(STREAK_BOARD)

    expect(titlesOf(body)).toEqual([BINARY_KING, GRID_MASTER, null])
    expect(body.playerEntry?.title).toEqual(GRID_MASTER)
  })
})

describe('the streak board under the puzzle rule', () => {
  it('lists only active streaks, each computed when read', async () => {
    // King's run needs #127, which closes unsolved at 20:00.
    await addPuzzleStreaker(KING, 30, '2026-10-20')
    await addPuzzleStreaker(COLLECTOR, 12)
    await addPuzzleStreaker(NEWCOMER, 3)
    await redis.zAdd('leaderboard:streaks:puzzle', { member: NEWCOMER, score: 50 })
    vi.setSystemTime(hoursAfterPost(128, 13))

    const body = await getStreakBoard()

    expect(streaksOf(body)).toEqual([
      { userId: COLLECTOR, streak: 12 },
      { userId: NEWCOMER, streak: 3 },
    ])
    expect(body.playerEntry).toMatchObject({ userId: COLLECTOR, streak: 12, rank: 1 })
  })

  it('shows the stored board when the puzzle board fails', async () => {
    await addStreaker(KING, 30)
    const zRange = redis.zRange
    vi.spyOn(redis, 'zRange').mockImplementation(async (key, ...rest) => {
      if (key === 'leaderboard:streaks:puzzle') throw new Error('Redis unavailable')
      return zRange(key, ...rest)
    })

    expect(streaksOf(await getStreakBoard())).toEqual([{ userId: KING, streak: 30 }])
  })

  it("reads the calendar board's stored streaks under the calendar rule, as today", async () => {
    await addPuzzleStreaker(NEWCOMER, 3)
    devvitServerFake.setSettings({ streakRule: ['calendar'] })
    await addStreaker(KING, 30)
    await addStreaker(COLLECTOR, 12)

    expect(streaksOf(await getStreakBoard())).toEqual([
      { userId: KING, streak: 30 },
      { userId: COLLECTOR, streak: 12 },
    ])
  })
})

describe('reading the boards', () => {
  it('writes nothing, so saved balances and titles stay as they were', async () => {
    await addTierSolver(KING, 80)
    await addStreaker(KING, 30)
    await addPuzzleStreaker(COLLECTOR, 12)
    const before = devvitServerFake.snapshot()

    await getBoard(TIER_BOARD)
    await getBoard(STREAK_BOARD)

    expect(devvitServerFake.snapshot()).toBe(before)
  })
})
