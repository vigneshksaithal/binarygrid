import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('./test-helpers/devvit-fake')).createDevvitServerFake()
)

import { context, redis, reddit } from '@devvit/web/server'
import { formatScoreShareText, type ScoreShareRequest } from '../shared/share-formatter'
import app from './routes/index'

const requestJson = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init))

const postJson = (path: string, body: unknown) =>
  requestJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const SCORE_THREAD_KEY = 'post:t3_post_123:scoreThreadCommentId'

const genericShare: ScoreShareRequest = {
  dayNumber: 42,
  solveTimeSeconds: 92,
  difficulty: 'medium',
}

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

  it('stores no user-ID index when a player opens the app', async () => {
    await postJson('/api/events', { eventName: 'app_open' })
    // The event route tracks in the background; let that work finish first
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(await redis.hGet('viral:user-index', 't2_user_456')).toBeUndefined()
    expect(await redis.get('viral:user-index:counter')).toBeUndefined()
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
    await redis.set(SCORE_THREAD_KEY, 't1_score_hub')
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

  it('posts exactly the text the player previewed', async () => {
    await redis.set(SCORE_THREAD_KEY, 't1_score_hub')
    // The client previews formatScoreShareText(request) and sends the same request
    const request: ScoreShareRequest = { ...genericShare, streak: 5, templateId: 'beat_time' }
    const preview = formatScoreShareText(request)

    const response = await postJson('/api/share-score', request)

    expect(response.status).toBe(200)
    expect(preview).toBe(
      'Solved Binary Grid #42 in 01:32 | Medium | 5-day streak\n\nBeat my time: 01:32.'
    )
    expect(reddit.submitComment).toHaveBeenCalledTimes(1)
    expect(reddit.submitComment).toHaveBeenCalledWith({
      runAs: 'USER',
      id: 't1_score_hub',
      text: preview,
    })
  })

  it('posts top-level when the player adds their own words', async () => {
    await redis.set(SCORE_THREAD_KEY, 't1_score_hub')
    const request: ScoreShareRequest = {
      ...genericShare,
      templateId: 'beat_time',
      customText: 'The corner was sneaky.',
    }

    const response = await postJson('/api/share-score', request)

    expect(response.status).toBe(200)
    expect(reddit.submitComment).toHaveBeenCalledWith({
      runAs: 'USER',
      id: 't3_post_123',
      text: 'Solved Binary Grid #42 in 01:32 | Medium\n\nThe corner was sneaky.',
    })
  })

  it('creates the score thread before replying when none is stored', async () => {
    const distinguish = vi.fn(() => Promise.resolve())
    vi.mocked(reddit.submitComment).mockResolvedValueOnce({ id: 't1_new_thread', distinguish } as never)

    const response = await postJson('/api/share-score', genericShare)

    expect(response.status).toBe(200)
    expect(reddit.submitComment).toHaveBeenNthCalledWith(1, {
      id: 't3_post_123',
      text: expect.stringContaining('score thread'),
    })
    expect(reddit.submitComment).toHaveBeenNthCalledWith(2, {
      runAs: 'USER',
      id: 't1_new_thread',
      text: 'Solved Binary Grid #42 in 01:32 | Medium',
    })
    expect(await redis.get(SCORE_THREAD_KEY)).toBe('t1_new_thread')
  })

  it('fails visibly instead of posting top-level when the score thread cannot be created', async () => {
    vi.mocked(reddit.submitComment).mockRejectedValueOnce(new Error('rate limited'))

    const response = await postJson('/api/share-score', genericShare)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false })
    expect(reddit.submitComment).toHaveBeenCalledTimes(1)
    expect(reddit.submitComment).not.toHaveBeenCalledWith(
      expect.objectContaining({ runAs: 'USER' })
    )
  })

  it('lets the player retry a failed share', async () => {
    vi.mocked(reddit.submitComment).mockRejectedValueOnce(new Error('rate limited'))
    await postJson('/api/share-score', genericShare)

    const retry = await postJson('/api/share-score', genericShare)

    expect(retry.status).toBe(200)
    expect(reddit.submitComment).toHaveBeenLastCalledWith({
      runAs: 'USER',
      id: 't1_comment_123',
      text: 'Solved Binary Grid #42 in 01:32 | Medium',
    })
  })

  it('rejects a logged-out share without posting', async () => {
    context.userId = undefined

    const response = await postJson('/api/share-score', genericShare)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'login required' })
    expect(reddit.submitComment).not.toHaveBeenCalled()
  })

  it('rejects an invalid share without posting', async () => {
    const response = await postJson('/api/share-score', { ...genericShare, dayNumber: 0 })

    expect(response.status).toBe(400)
    expect(reddit.submitComment).not.toHaveBeenCalled()
  })

  it.each(['/api/post-replay', '/api/comment-score', '/api/streak-confession'])(
    'no longer serves %s',
    async (path) => {
      const response = await postJson(path, { ...genericShare, streak: 7, grid: [[0, 1]] })

      expect(response.status).toBe(404)
      expect(reddit.submitComment).not.toHaveBeenCalled()
    }
  )
})
