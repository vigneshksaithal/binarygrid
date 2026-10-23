import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('../test-helpers/devvit-server-fake')).devvitServerFake.module
)

import { redis } from '@devvit/web/server'
import { devvitServerFake, FAKE_POST_ID, FAKE_USER_ID } from '../test-helpers/devvit-server-fake'
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

const addTierSolver = async (userId: string, timeSeconds: number) => {
  await redis.zAdd(`leaderboard:${PUZZLE_ID}`, { member: userId, score: timeSeconds })
  await redis.hSet(`leaderboard:${PUZZLE_ID}:meta`, {
    [userId]: JSON.stringify({ username: userId.slice(3), avatarUrl: null, attempts: 1 }),
  })
}

const addStreaker = async (userId: string, streak: number) => {
  await redis.zAdd('leaderboard:streaks', { member: userId, score: streak })
  await redis.hSet('user:meta', {
    [userId]: JSON.stringify({ username: userId.slice(3), avatarUrl: null }),
  })
}

const getBoard = async (path: string): Promise<BoardBody> => {
  const response = await app.fetch(new Request(`http://localhost${path}`))
  expect(response.status).toBe(200)
  return (await response.json()) as BoardBody
}

const titlesOf = (body: BoardBody) => body.entries.map((entry) => entry.title)

beforeEach(async () => {
  devvitServerFake.reset()
  await saveTitles(KING, 'binary_king', ['puzzler', 'grid_master', 'binary_king'])
  await saveTitles(COLLECTOR, 'puzzler', ['puzzler', 'streak_lord', 'grid_master'])
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
  it("shows each listed player's title, including the player's own entry", async () => {
    await addStreaker(KING, 30)
    await addStreaker(COLLECTOR, 12)
    await addStreaker(NEWCOMER, 3)

    const body = await getBoard(STREAK_BOARD)

    expect(titlesOf(body)).toEqual([BINARY_KING, GRID_MASTER, null])
    expect(body.playerEntry?.title).toEqual(GRID_MASTER)
  })
})

describe('reading the boards', () => {
  it('writes nothing, so saved balances and titles stay as they were', async () => {
    await addTierSolver(KING, 80)
    await addStreaker(KING, 30)
    const before = devvitServerFake.snapshot()

    await getBoard(TIER_BOARD)
    await getBoard(STREAK_BOARD)

    expect(devvitServerFake.snapshot()).toBe(before)
  })
})
