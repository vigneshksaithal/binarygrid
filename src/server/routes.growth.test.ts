import { beforeEach, describe, expect, it, vi } from 'vitest'

type ZMember = { member: string; score: number }

vi.mock('@devvit/web/server', () => {
  const redisStore = new Map<string, string>()
  const hashStore = new Map<string, Record<string, string>>()
  const zsetStore = new Map<string, Map<string, number>>()

  const getZSet = (key: string): Map<string, number> => {
    const existing = zsetStore.get(key)
    if (existing) return existing
    const next = new Map<string, number>()
    zsetStore.set(key, next)
    return next
  }

  const sortedMembers = (key: string, reverse = false): ZMember[] => {
    const entries = Array.from(getZSet(key).entries()).map(([member, score]) => ({
      member,
      score,
    }))
    return entries.sort((a, b) => reverse ? b.score - a.score : a.score - b.score)
  }

  const context = {
    postId: 't3_post_123',
    userId: 't2_user_456',
    subredditName: 'binarygrid',
  }

  return {
    context,
    cache: vi.fn((fn: () => Promise<unknown>) => fn()),
    redis: {
      get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
      set: vi.fn((key: string, value: string) => {
        redisStore.set(key, value)
        return Promise.resolve()
      }),
      del: vi.fn((key: string) => {
        redisStore.delete(key)
        hashStore.delete(key)
        zsetStore.delete(key)
        return Promise.resolve()
      }),
      expire: vi.fn(() => Promise.resolve()),
      incrBy: vi.fn((key: string, amount: number) => {
        const current = Number.parseInt(redisStore.get(key) ?? '0', 10)
        const next = current + amount
        redisStore.set(key, next.toString())
        return Promise.resolve(next)
      }),
      hSet: vi.fn((key: string, value: Record<string, string>) => {
        hashStore.set(key, { ...(hashStore.get(key) ?? {}), ...value })
        return Promise.resolve()
      }),
      hGet: vi.fn((key: string, field: string) =>
        Promise.resolve(hashStore.get(key)?.[field] ?? null)
      ),
      hGetAll: vi.fn((key: string) => Promise.resolve(hashStore.get(key) ?? {})),
      hMGet: vi.fn((key: string, fields: string[]) =>
        Promise.resolve(fields.map((field) => hashStore.get(key)?.[field] ?? null))
      ),
      zAdd: vi.fn((key: string, entry: ZMember) => {
        getZSet(key).set(entry.member, entry.score)
        return Promise.resolve()
      }),
      zRank: vi.fn((key: string, member: string) => {
        const index = sortedMembers(key).findIndex((entry) => entry.member === member)
        return Promise.resolve(index >= 0 ? index : undefined)
      }),
      zScore: vi.fn((key: string, member: string) =>
        Promise.resolve(getZSet(key).get(member))
      ),
      zCard: vi.fn((key: string) => Promise.resolve(getZSet(key).size)),
      zRange: vi.fn((
        key: string,
        start: number,
        stop: number,
        options?: { by?: 'rank' | 'score'; reverse?: boolean }
      ) => {
        const members = sortedMembers(key, options?.reverse)
        if (options?.by === 'score') {
          return Promise.resolve(
            members.filter((entry) => entry.score >= start && entry.score <= stop)
          )
        }
        return Promise.resolve(members.slice(start, stop + 1))
      }),
      __store: redisStore,
      __hashStore: hashStore,
      __zsetStore: zsetStore,
      __clearStore: () => {
        redisStore.clear()
        hashStore.clear()
        zsetStore.clear()
      },
    },
    reddit: {
      submitComment: vi.fn(() => Promise.resolve({ id: 't1_comment_123' })),
      submitCustomPost: vi.fn(() => Promise.resolve({ id: 't3_recap_123' })),
      getCurrentUser: vi.fn(() => Promise.resolve({ username: 'testuser' })),
      getCurrentUsername: vi.fn(() => Promise.resolve('testuser')),
      getSnoovatarUrl: vi.fn(() => Promise.resolve(null)),
      subscribeToCurrentSubreddit: vi.fn(() => Promise.resolve()),
    },
  }
})

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
