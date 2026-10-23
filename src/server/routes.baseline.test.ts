import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('./test-helpers/devvit-fake')).createDevvitServerFake()
)

import { context, reddit, redis } from '@devvit/web/server'
import type { Grid } from '../shared/types/puzzle'
import app from './routes/index'
import { type createDevvitServerFake, fakeListing } from './test-helpers/devvit-fake'

type Fake = ReturnType<typeof createDevvitServerFake>
type Moderator = { id: string; username: string }

const fakeRedis = redis as unknown as Fake['redis']
const fakeReddit = reddit as unknown as Fake['reddit']
const fakeContext = context as Fake['context'] & { userId: string | undefined }

// The fake's current user: context.userId t2_user_456, getCurrentUsername 'testuser'.
const CURRENT_MODERATOR: Moderator = { id: 't2_user_456', username: 'testuser' }
const OTHER_MODERATOR: Moderator = { id: 't2_other_mod', username: 'othermod' }
const MODERATORS_ONLY_TOAST = {
  showToast: { text: 'Only moderators can see these numbers.', appearance: 'neutral' },
}

const listModerators = (moderators: readonly Moderator[]) =>
  fakeReddit.getModerators.mockImplementation(() => fakeListing(moderators))

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

const FIRST_ATTEMPT_ID = 'attempt-0001'
const SECOND_ATTEMPT_ID = 'attempt-0002'

const submit = (grid: Grid, attemptId = FIRST_ATTEMPT_ID) =>
  postJson('/api/submit', { id: 't3_post_123:medium', attemptId, grid, solveTimeSeconds: 92 })

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2026-10-21T08:15:00.000Z'), toFake: ['Date'] })
  vi.clearAllMocks()
  fakeRedis.__clearStore()
  fakeContext.userId = 't2_user_456'
  listModerators([])
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

    await submit(VALID_GRID, SECOND_ATTEMPT_ID)

    expect(fakeRedis.__hashStore.get(HOURLY_KEY)).toEqual({ '08': '2' })
  })

  it('does not move again when the same attempt is retried', async () => {
    await submit(VALID_GRID)
    const retried = await submit(VALID_GRID)

    expect(retried.status).toBe(200)
    expect((await retried.json()).ok).toBe(true)
    expect(fakeRedis.__hashStore.get(HOURLY_KEY)).toEqual({ '08': '1' })
  })

  it('never moves on a rejected submit', async () => {
    const invalidGrid = VALID_GRID.map((row) => row.map(() => 0)) as Grid
    const rejected = await submit(invalidGrid)
    fakeContext.userId = undefined
    const loggedOut = await submit(VALID_GRID)

    expect((await rejected.json()).ok).toBe(false)
    expect(loggedOut.status).toBe(401)
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
    listModerators([CURRENT_MODERATOR])
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
    expect(fakeReddit.getModerators).toHaveBeenCalledWith({
      subredditName: 'binarygrid',
      username: 'testuser',
    })
  })

  it('shows a non-moderator a neutral toast without reading the metrics', async () => {
    await redis.hSet('metrics:daily:2026-10-20', { wrs: '12', new_users: '2' })

    const response = await postJson('/internal/menu/baseline-readout', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(MODERATORS_ONLY_TOAST)
    expect(fakeRedis.hGetAll).not.toHaveBeenCalled()
  })

  it('only counts the current user as a moderator when the listing names them', async () => {
    listModerators([OTHER_MODERATOR])

    const response = await postJson('/internal/menu/baseline-readout', {})

    expect(await response.json()).toEqual(MODERATORS_ONLY_TOAST)
    expect(fakeRedis.hGetAll).not.toHaveBeenCalled()
  })

  it('denies a logged-out caller without asking Reddit', async () => {
    fakeContext.userId = undefined

    const response = await postJson('/internal/menu/baseline-readout', {})

    expect(await response.json()).toEqual(MODERATORS_ONLY_TOAST)
    expect(fakeReddit.getModerators).not.toHaveBeenCalled()
  })

  it('shows a toast with no metrics when the moderator check fails', async () => {
    listModerators([CURRENT_MODERATOR])
    fakeReddit.getCurrentUsername.mockRejectedValueOnce(new Error('reddit unavailable'))

    const response = await postJson('/internal/menu/baseline-readout', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      showToast: {
        text: 'Could not load the baseline metrics. Try again later.',
        appearance: 'neutral',
      },
    })
    expect(fakeRedis.hGetAll).not.toHaveBeenCalled()
  })

  it('shows a toast instead of failing when the readout cannot load', async () => {
    listModerators([CURRENT_MODERATOR])
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

describe('post slot and shop readout endpoint', () => {
  const seedReadoutRecords = async () => {
    await redis.hSet('metrics:baseline:state', { posts_through: '2026-10-13' })
    await redis.hSet('metrics:daily:2026-10-13', {
      posts_recorded: '1',
      'post:t3_morning': JSON.stringify({
        slot: 'Morning',
        hour: 8,
        solvers: 4,
        easy: 4,
        medium: 0,
        hard: 0,
        subfloor: 0,
      }),
    })
    await redis.hSet('metrics:daily:2026-10-20', {
      app_open: '10',
      shop_open: '2',
      recorded_at: '2026-10-21T00:30:00.000Z',
    })
  }

  it('answers a moderator with the slot medians and the daily openers', async () => {
    listModerators([CURRENT_MODERATOR])
    await seedReadoutRecords()

    const response = await postJson('/internal/menu/slot-shop-readout', {
      location: 'subreddit',
      targetId: 't5_abc',
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      showToast: {
        text: 'Median solvers/post to 2026-10-13: Morning too few posts (1), Evening too few posts (0) · Openers/day: shop 2, app 10 (1 day)',
        appearance: 'neutral',
      },
    })
  })

  it('shows a non-moderator a neutral toast without reading the records', async () => {
    await seedReadoutRecords()

    const response = await postJson('/internal/menu/slot-shop-readout', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(MODERATORS_ONLY_TOAST)
    expect(fakeRedis.hGetAll).not.toHaveBeenCalled()
  })

  it('shows a toast instead of failing when the numbers cannot load', async () => {
    listModerators([CURRENT_MODERATOR])
    fakeRedis.hGetAll.mockRejectedValueOnce(new Error('redis unavailable'))

    const response = await postJson('/internal/menu/slot-shop-readout', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      showToast: {
        text: 'Could not load the post slot and shop numbers. Try again later.',
        appearance: 'neutral',
      },
    })
  })
})
