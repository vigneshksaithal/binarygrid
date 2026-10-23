import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('./test-helpers/devvit-fake')).createDevvitServerFake()
)

import { context, redis, reddit } from '@devvit/web/server'
import app from './routes/index'

const requestJson = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init))

describe('growth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mockedRedis = redis as unknown as { __clearStore: () => void }
    mockedRedis.__clearStore()
    context.postId = 't3_post_123'
    context.userId = 't2_user_456'
  })

  it('records an allowlisted analytics event', async () => {
    const response = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventName: 'app_open' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(redis.incrBy).toHaveBeenCalled()
  })

  it('rejects unknown analytics events', async () => {
    const response = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventName: 'upvote_prompt' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns daily progress for completed difficulties and missions', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await redis.hSet(`user:t2_user_456:daily:${today}:completed`, {
      easy: JSON.stringify({ solveTimeSeconds: 52, solveQuality: 'clean' }),
      medium: JSON.stringify({ solveTimeSeconds: 142, solveQuality: 'sharp' }),
    })
    await redis.set('user:t2_user_456:streak:freezes', '1')

    const response = await requestJson('/api/daily-progress')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.completedDifficulties).toEqual(['easy', 'medium'])
    expect(body.trio.completedCount).toBe(2)
    expect(body.streak.freezes).toBe(1)
    expect(body.missions).toHaveLength(3)
  })

  it('returns player context with percentile and next rank target', async () => {
    await redis.zAdd('leaderboard:t3_post_123:medium', {
      member: 't2_fast',
      score: 80,
    })
    await redis.zAdd('leaderboard:t3_post_123:medium', {
      member: 't2_user_456',
      score: 92,
    })
    await redis.zAdd('leaderboard:t3_post_123:medium', {
      member: 't2_slow',
      score: 140,
    })

    const response = await requestJson('/api/player-context?puzzleId=t3_post_123:medium')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rank).toBe(2)
    expect(body.totalEntries).toBe(3)
    expect(body.fasterThanPercentile).toBe(33)
    expect(body.nextRankSeconds).toBe(12)
  })

  it('shares a score as a user reply under the stored score thread', async () => {
    await redis.set('post:t3_post_123:scoreThreadCommentId', 't1_score_hub')

    const response = await requestJson('/api/share-score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'scoreThread',
        solveTimeSeconds: 92,
        difficulty: 'medium',
        dayNumber: 42,
        solveQuality: 'clean',
        streak: 5,
        rank: 2,
        templateId: 'beat_time',
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(reddit.submitComment).toHaveBeenCalledWith({
      runAs: 'USER',
      id: 't1_score_hub',
      text: expect.stringContaining('Beat my time'),
    })
  })

  it('keeps duplicate score shares idempotent', async () => {
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'scoreThread',
        solveTimeSeconds: 92,
        difficulty: 'medium',
        dayNumber: 42,
        solveQuality: 'clean',
      }),
    }

    await requestJson('/api/share-score', request)
    await requestJson('/api/share-score', request)

    expect(reddit.submitComment).toHaveBeenCalledTimes(1)
  })
})
