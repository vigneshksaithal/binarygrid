import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('../test-helpers/devvit-server-fake')).devvitServerFake.module
)

import { redis } from '@devvit/web/server'
import { devvitServerFake, FAKE_USER_ID } from '../test-helpers/devvit-server-fake'
import app from './index'

// Saved before coins were retired: enough to buy Binary King, and Grid Master owned.
const SAVED_ECONOMY = JSON.stringify({
  coins: 600,
  totalCoins: 1800,
  totalSolves: 120,
  speedSolves: 15,
  equippedTitle: 'puzzler',
  ownedTitles: ['puzzler', 'grid_master'],
  dailyFirstSolve: '2026-10-21',
})

beforeEach(async () => {
  devvitServerFake.reset()
  await redis.hSet(`user:${FAKE_USER_ID}:economy`, { economy: SAVED_ECONOMY })
  await redis.zAdd('leaderboard:coins', { member: FAKE_USER_ID, score: 1800 })
})

describe('retired coin routes', () => {
  it.each([
    ['GET', '/api/economy', undefined],
    ['GET', '/api/shop', undefined],
    ['POST', '/api/shop/buy', { titleId: 'binary_king' }],
    ['POST', '/api/shop/equip', { titleId: 'grid_master' }],
    ['GET', '/api/leaderboard/coins', undefined],
  ])('answer %s %s with 404 and change nothing', async (method, path, body) => {
    const before = devvitServerFake.snapshot()

    const response = await app.fetch(
      new Request(`http://localhost${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    )

    expect(response.status).toBe(404)
    expect(devvitServerFake.snapshot()).toBe(before)
  })
})
