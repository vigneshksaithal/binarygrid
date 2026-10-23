import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('./test-helpers/devvit-fake')).createDevvitServerFake()
)

import { context, redis } from '@devvit/web/server'
import type { Grid } from '../shared/types/puzzle'
import app from './routes/index'
import type { createDevvitServerFake } from './test-helpers/devvit-fake'

type Fake = ReturnType<typeof createDevvitServerFake>

const fakeRedis = redis as unknown as Fake['redis']
const fakeContext = context as Fake['context'] & { userId: string | undefined }

const HOURLY_KEY = 'daily:2026-10-21:hourly:submit_success'

const VALID_GRID: Grid = [
  [0, 1, 0, 1, 1, 0],
  [1, 0, 1, 0, 0, 1],
  [0, 1, 1, 0, 1, 0],
  [1, 0, 0, 1, 0, 1],
  [0, 1, 0, 1, 1, 0],
  [1, 0, 1, 0, 0, 1],
]

const postJson = (path: string, body: unknown) =>
  app.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

const submit = (grid: Grid) =>
  postJson('/api/submit', { id: 't3_post_123:medium', grid, solveTimeSeconds: 92 })

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2026-10-21T08:15:00.000Z'), toFake: ['Date'] })
  vi.clearAllMocks()
  fakeRedis.__clearStore()
  fakeContext.userId = 't2_user_456'
  await redis.hSet('post:t3_post_123:puzzle:medium', { id: 't3_post_123:medium', fixed: '[]' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('hourly solve counter on submit', () => {
  it('moves once per successful submit', async () => {
    const response = await submit(VALID_GRID)

    expect(response.status).toBe(200)
    expect((await response.json()).ok).toBe(true)
    expect(fakeRedis.__hashStore.get(HOURLY_KEY)).toEqual({ '08': '1' })

    await submit(VALID_GRID)

    expect(fakeRedis.__hashStore.get(HOURLY_KEY)).toEqual({ '08': '2' })
  })

  it('never moves on a rejected submit', async () => {
    const invalidGrid = VALID_GRID.map((row) => row.map(() => 0)) as Grid
    const rejected = await submit(invalidGrid)
    fakeContext.userId = undefined
    const loggedOut = await submit(VALID_GRID)

    expect((await rejected.json()).ok).toBe(false)
    expect(loggedOut.status).toBe(400)
    expect(fakeRedis.hIncrBy).not.toHaveBeenCalled()
    expect(fakeRedis.__hashStore.get(HOURLY_KEY)).toBeUndefined()
  })
})

describe('baseline internal endpoints', () => {
  it('runs the nightly baseline job from the scheduler endpoint', async () => {
    const response = await postJson('/internal/schedule/baseline', { name: 'baseline-nightly' })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', dailyRecords: 59 })
    expect(fakeRedis.__hashStore.get('metrics:daily:2026-10-20')?.recorded_at).toBeDefined()
  })

  it('reports a failed run with a server error', async () => {
    fakeRedis.hKeys.mockRejectedValueOnce(new Error('redis unavailable'))

    const response = await postJson('/internal/schedule/baseline', { name: 'baseline-nightly' })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      status: 'error',
      message: 'Baseline job failed: redis unavailable',
    })
  })

  it('answers the moderator menu item with a readout toast', async () => {
    await redis.hSet('metrics:daily:2026-10-20', { wrs: '12', new_users: '2' })

    const response = await postJson('/internal/menu/baseline-readout', {
      location: 'subreddit',
      targetId: 't5_abc',
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      showToast: {
        text: 'WRS 12 (2026-10-20) · New users 2026-W43: 2 · Day-1 retention pending',
        appearance: 'neutral',
      },
    })
  })

  it('shows a toast instead of failing when the readout cannot load', async () => {
    fakeRedis.hGetAll.mockRejectedValueOnce(new Error('redis unavailable'))

    const response = await postJson('/internal/menu/baseline-readout', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      showToast: {
        text: 'Could not load the baseline metrics. Try again later.',
        appearance: 'neutral',
      },
    })
  })
})
