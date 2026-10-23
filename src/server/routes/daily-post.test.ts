import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import devvitConfig from '../../../devvit.json'
import { DAILY_DIFFICULTIES } from '../../shared/growth'
import { createPost } from '../core/post'
import { readPostPuzzle } from '../core/post-puzzle'
import { readPostStamp } from '../core/puzzle-number'
import { readDatePuzzle } from '../core/puzzle-set'
import app from './index'

const MORNING_TASK = '/internal/schedule/daily-morning'
const EVENING_TASK = '/internal/schedule/daily-evening'
const RETRY_TASK = '/internal/schedule/daily-retry'

const DAY_ONE = '2026-10-22'
const DAY_TWO = '2026-10-23'
const DAY_ONE_EARLY = new Date('2026-10-22T06:00:00.000Z')
const DAY_ONE_MORNING = new Date('2026-10-22T08:00:00.000Z')
const DAY_ONE_MENU_POST = new Date('2026-10-22T08:05:00.000Z')
const DAY_ONE_FIRST_RETRY = new Date('2026-10-22T08:15:00.000Z')
const DAY_ONE_EVENING = new Date('2026-10-22T20:00:00.000Z')
const DAY_TWO_LATE_RETRY = new Date('2026-10-23T00:30:00.000Z')
const DAY_TWO_MORNING = new Date('2026-10-23T08:00:00.000Z')
const DAY_TWO_EVENING = new Date('2026-10-23T20:00:00.000Z')

const MINUTE_MS = 60_000

let postCount = 0

type ScheduledJob = { name: string; runAt: Date; data?: unknown }

const useSlot = (slot: string) =>
  fake.settings.getAll.mockResolvedValue({ dailyPostSlot: [slot] })

const postTask = async (path: string, body: unknown) => {
  const response = await app.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  return { status: response.status, body: await response.json() }
}

// Runs a scheduler task the way Devvit does: a POST with the task name, at the cron's time.
const runTask = (path: string, at: Date) => {
  vi.setSystemTime(at)
  const name = path === MORNING_TASK ? 'daily-post-morning' : 'daily-post-evening'
  return postTask(path, { name })
}

const scheduledJobs = (): ScheduledJob[] =>
  fake.scheduler.runJob.mock.calls.map(([job]) => job)

// Delivers a one-off job the app scheduled, at its time unless the platform runs it late.
const runRetry = (job: ScheduledJob, at: Date = job.runAt) => {
  vi.setSystemTime(at)
  return postTask(RETRY_TASK, { name: job.name, data: job.data })
}

const runLastScheduledRetry = (at?: Date) => {
  const job = scheduledJobs().at(-1)
  if (!job) throw new Error('No retry was scheduled')
  return runRetry(job, at)
}

const postedTitles = () =>
  fake.reddit.submitCustomPost.mock.calls.map(([options]) => options.title)

const posted = (postId: string) => ({ status: 'posted', postId, nextDatePuzzles: 'ready' })

const completed = (postId: string) => ({ status: 'completed', postId, nextDatePuzzles: 'ready' })

const failedPost = (message: string, retryAt: Date | null) => ({
  status: 500,
  body: {
    status: 'error',
    message: `Failed to create daily puzzle post: ${message}`,
    retryAt: retryAt?.toISOString() ?? null,
  },
})

const minutesAfter = (time: Date, minutes: number) => new Date(time.getTime() + minutes * MINUTE_MS)

const expectEveryTierStored = async (postId: string, date: string) => {
  for (const difficulty of DAILY_DIFFICULTIES) {
    const served = await readPostPuzzle(postId, difficulty)
    expect(served?.id).toBe(`${postId}:${difficulty}`)
    expect(served?.initial).toEqual((await readDatePuzzle(date, difficulty))?.initial)
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  fake.redis.__clearStore()
  postCount = 0
  // Only accepted posts get an ID, so postCount counts the posts Reddit holds.
  fake.reddit.submitCustomPost.mockImplementation(() => {
    postCount += 1
    return Promise.resolve({ id: `t3_post_${postCount}` })
  })
  fake.settings.getAll.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('daily post tasks', () => {
  it('posts from the morning task by default and skips the evening task', async () => {
    const morning = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const evening = await runTask(EVENING_TASK, DAY_ONE_EVENING)

    expect(morning).toEqual({ status: 200, body: posted('t3_post_1') })
    expect(evening).toEqual({ status: 200, body: { status: 'skipped', reason: 'other_slot' } })
    expect(postedTitles()).toEqual(['Binary Grid #1'])
  })

  it('posts from the evening task when dailyPostSlot is evening', async () => {
    useSlot('evening')

    const morning = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const evening = await runTask(EVENING_TASK, DAY_ONE_EVENING)

    expect(morning.body).toEqual({ status: 'skipped', reason: 'other_slot' })
    expect(evening.body).toEqual(posted('t3_post_1'))
    expect(postedTitles()).toEqual(['Binary Grid #1'])
  })

  it('posts once on the day the slot moves to evening, then each evening', async () => {
    await runTask(MORNING_TASK, DAY_ONE_MORNING)
    useSlot('evening')

    const sameDay = await runTask(EVENING_TASK, DAY_ONE_EVENING)
    const nextMorning = await runTask(MORNING_TASK, DAY_TWO_MORNING)
    const nextEvening = await runTask(EVENING_TASK, DAY_TWO_EVENING)

    expect(sameDay.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(nextMorning.body).toEqual({ status: 'skipped', reason: 'other_slot' })
    expect(nextEvening.body).toEqual(posted('t3_post_2'))
    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #2'])
  })

  it('posts the next morning after the slot moves back to morning', async () => {
    useSlot('evening')
    await runTask(EVENING_TASK, DAY_ONE_EVENING)
    useSlot('morning')

    const nextMorning = await runTask(MORNING_TASK, DAY_TWO_MORNING)
    const nextEvening = await runTask(EVENING_TASK, DAY_TWO_EVENING)

    expect(nextMorning.body).toEqual(posted('t3_post_2'))
    expect(nextEvening.body).toEqual({ status: 'skipped', reason: 'other_slot' })
    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #2'])
  })

  it('never posts twice for a date when a task is delivered again', async () => {
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const repeat = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(repeat.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
  })

  it('still posts after an earlier moderator post that day, under the same number', async () => {
    vi.setSystemTime(DAY_ONE_EARLY)
    await createPost(DAY_ONE_EARLY)

    const morning = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(morning.body).toEqual(posted('t3_post_2'))
    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #1'])
  })

  it('claims a date for ten minutes until Reddit accepts its post, then keeps the post ID', async () => {
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const writes = fake.redis.set.mock.calls.filter(([key]) => key === `puzzle:daily-post:${DAY_ONE}`)

    expect(writes).toEqual([
      [
        `puzzle:daily-post:${DAY_ONE}`,
        'pending:2026-10-22T08:00:00.000Z',
        { nx: true, expiration: minutesAfter(DAY_ONE_MORNING, 10) },
      ],
      [`puzzle:daily-post:${DAY_ONE}`, 't3_post_1'],
    ])
  })

  it('reports a failed post and lets a later run post for the date', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const retried = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(failed).toEqual(failedPost('Reddit is down', DAY_ONE_FIRST_RETRY))
    expect(retried.body).toEqual(posted('t3_post_1'))
  })

  it('keeps the date for its post when storing the puzzles fails after posting', async () => {
    fake.redis.hSet.mockRejectedValueOnce(new Error('Redis write failed'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const repeat = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    useSlot('evening')
    const evening = await runTask(EVENING_TASK, DAY_ONE_EVENING)

    expect(failed).toEqual(failedPost('Redis write failed', DAY_ONE_FIRST_RETRY))
    expect(repeat.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(evening.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
    // The date's record names the post, so a repair can find it.
    expect(await fake.redis.get('puzzle:daily-post:2026-10-22')).toBe('t3_post_1')
  })

  it('keeps the date when the first write after posting fails', async () => {
    fake.reddit.submitCustomPost.mockImplementationOnce(() => {
      // Reddit has the post; the next Redis write fails.
      fake.redis.set.mockRejectedValueOnce(new Error('Redis write failed'))
      return Promise.resolve({ id: 't3_post_1' })
    })

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const repeat = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(failed.status).toBe(500)
    expect(repeat.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
  })

  it('posts nothing when the setting cannot be read, and retries the run', async () => {
    fake.settings.getAll.mockRejectedValueOnce(new Error('Could not get installation settings'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(failed.status).toBe(500)
    expect(fake.reddit.submitCustomPost).not.toHaveBeenCalled()
    expect(scheduledJobs()).toHaveLength(1)
  })

  it('keeps both daily tasks in devvit.json, each on its own endpoint', () => {
    const { tasks } = devvitConfig.scheduler

    expect(tasks['daily-post-morning']).toEqual({ endpoint: MORNING_TASK, cron: '0 8 * * *' })
    expect(tasks['daily-post-evening']).toEqual({ endpoint: EVENING_TASK, cron: '0 20 * * *' })
  })
})

describe("the next date's puzzles", () => {
  it("are stored after posting, and the next date's post serves them", async () => {
    await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const storedAhead = await readDatePuzzle(DAY_TWO, 'hard')

    await runTask(MORNING_TASK, DAY_TWO_MORNING)

    expect(storedAhead).not.toBeNull()
    expect((await readPostPuzzle('t3_post_2', 'hard'))?.initial).toEqual(storedAhead?.initial)
  })

  it('may fail without failing the post, and the next date generates its own', async () => {
    const realSet = fake.redis.set.getMockImplementation()
    if (!realSet) throw new Error('The fake has no set')
    fake.redis.set.mockImplementation((key, value, options) =>
      key.startsWith(`puzzle:set:${DAY_TWO}:`)
        ? Promise.reject(new Error('Redis write failed'))
        : realSet(key, value, options)
    )

    const today = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    fake.redis.set.mockImplementation(realSet)
    const tomorrow = await runTask(MORNING_TASK, DAY_TWO_MORNING)

    expect(today).toEqual({ status: 200, body: { ...posted('t3_post_1'), nextDatePuzzles: 'failed' } })
    expect(tomorrow.body).toEqual(posted('t3_post_2'))
    await expectEveryTierStored('t3_post_2', DAY_TWO)
  })
})

describe('daily post retry', () => {
  it('is scheduled once, 15 minutes after a post Reddit turned down, for that date and slot', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))

    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(scheduledJobs()).toEqual([
      {
        name: 'daily-post-retry',
        runAt: DAY_ONE_FIRST_RETRY,
        data: { date: DAY_ONE, slot: 'morning', attempt: 1 },
      },
    ])
  })

  it('posts the date once, and posts nothing when delivered again', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const retried = await runLastScheduledRetry()
    const again = await runLastScheduledRetry()
    const repeatedMorning = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(retried).toEqual({ status: 200, body: posted('t3_post_1') })
    expect(again.body).toEqual(completed('t3_post_1'))
    expect(repeatedMorning.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(postCount).toBe(1)
    expect(postedTitles().at(-1)).toBe('Binary Grid #1')
    await expectEveryTierStored('t3_post_1', DAY_ONE)
  })

  it('posts nothing after the run succeeded', async () => {
    await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const staleRetry = {
      name: 'daily-post-retry',
      runAt: DAY_ONE_FIRST_RETRY,
      data: { date: DAY_ONE, slot: 'morning', attempt: 1 },
    }

    const retried = await runRetry(staleRetry)

    expect(retried.body).toEqual(completed('t3_post_1'))
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
  })

  it('posts for the intended date and number when it runs after midnight', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const lateRetry = await runLastScheduledRetry(DAY_TWO_LATE_RETRY)
    const nextMorning = await runTask(MORNING_TASK, DAY_TWO_MORNING)

    expect(lateRetry.body).toEqual(posted('t3_post_1'))
    expect(nextMorning.body).toEqual(posted('t3_post_2'))
    expect(postedTitles().slice(-2)).toEqual(['Binary Grid #1', 'Binary Grid #2'])
    expect(await readPostStamp('t3_post_1')).toEqual({ number: 1, createdAt: DAY_TWO_LATE_RETRY })
    expect(await fake.redis.get(`puzzle:daily-post:${DAY_ONE}`)).toBe('t3_post_1')
    await expectEveryTierStored('t3_post_1', DAY_ONE)
  })

  it('stores the puzzles of a post left without them, with no second post', async () => {
    fake.redis.hSet.mockRejectedValueOnce(new Error('Redis write failed'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const retried = await runLastScheduledRetry()

    expect(scheduledJobs()[0]?.data).toEqual({
      date: DAY_ONE,
      slot: 'morning',
      attempt: 1,
      post: { id: 't3_post_1', createdAt: DAY_ONE_MORNING.toISOString() },
    })
    expect(retried).toEqual({ status: 200, body: completed('t3_post_1') })
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
    expect(await readPostStamp('t3_post_1')).toEqual({ number: 1, createdAt: DAY_ONE_MORNING })
    await expectEveryTierStored('t3_post_1', DAY_ONE)
    expect(await readDatePuzzle(DAY_TWO, 'hard')).not.toBeNull()
  })

  it('finishes and records a post whose ID the run could not store', async () => {
    fake.reddit.submitCustomPost.mockImplementationOnce(() => {
      // Reddit has the post; storing its ID fails, which stops the run before the stamp.
      fake.redis.set.mockRejectedValueOnce(new Error('Redis write failed'))
      return Promise.resolve({ id: 't3_post_1' })
    })
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const retried = await runLastScheduledRetry()
    const repeatedMorning = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(retried.body).toEqual(completed('t3_post_1'))
    expect(repeatedMorning.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
    expect(await fake.redis.get(`puzzle:daily-post:${DAY_ONE}`)).toBe('t3_post_1')
    expect(await readPostStamp('t3_post_1')).toEqual({ number: 1, createdAt: DAY_ONE_MORNING })
    await expectEveryTierStored('t3_post_1', DAY_ONE)
  })

  it("posts nothing once the slot moved, so the chosen slot's task posts", async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)
    useSlot('evening')

    const retried = await runLastScheduledRetry()
    const evening = await runTask(EVENING_TASK, DAY_ONE_EVENING)

    expect(retried.body).toEqual({ status: 'skipped', reason: 'other_slot' })
    expect(evening.body).toEqual(posted('t3_post_1'))
    expect(postCount).toBe(1)
  })

  it('leaves a date another run is posting', async () => {
    await fake.redis.set(`puzzle:daily-post:${DAY_ONE}`, 'pending:2026-10-22T08:14:00.000Z')
    const retry = {
      name: 'daily-post-retry',
      runAt: DAY_ONE_FIRST_RETRY,
      data: { date: DAY_ONE, slot: 'morning', attempt: 1 },
    }

    const retried = await runRetry(retry)

    expect(retried.body).toEqual({ status: 'skipped', reason: 'already_posted' })
    expect(fake.reddit.submitCustomPost).not.toHaveBeenCalled()
  })

  it('posts nothing when a moderator already posted the date', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)
    vi.setSystemTime(DAY_ONE_MENU_POST)
    const menuPost = await createPost(DAY_ONE_MENU_POST)

    const retried = await runLastScheduledRetry()

    expect(retried.body).toEqual(completed(menuPost.id))
    expect(postCount).toBe(1)
  })

  it('posts once the claim its run could not release has lapsed', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))
    fake.redis.del.mockRejectedValueOnce(new Error('Redis is down'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const leftClaim = await fake.redis.get(`puzzle:daily-post:${DAY_ONE}`)
    // The claim's ten-minute lease ran out before the retry.
    fake.redis.__store.delete(`puzzle:daily-post:${DAY_ONE}`)

    const retried = await runLastScheduledRetry()

    expect(leftClaim).toBe('pending:2026-10-22T08:00:00.000Z')
    expect(retried.body).toEqual(posted('t3_post_1'))
  })

  it('schedules the next retry when it fails, three in all, about 15 min, 1 h and 3 h after the run', async () => {
    fake.reddit.submitCustomPost.mockRejectedValue(new Error('Reddit is down'))
    await runTask(MORNING_TASK, DAY_ONE_MORNING)

    const first = await runLastScheduledRetry()
    const second = await runLastScheduledRetry()
    const third = await runLastScheduledRetry()

    const runTimes = scheduledJobs().map((job) => job.runAt)
    expect(runTimes).toEqual([
      minutesAfter(DAY_ONE_MORNING, 15),
      minutesAfter(DAY_ONE_MORNING, 60),
      minutesAfter(DAY_ONE_MORNING, 180),
    ])
    expect(scheduledJobs().map((job) => job.data)).toEqual(
      [1, 2, 3].map((attempt) => ({ date: DAY_ONE, slot: 'morning', attempt }))
    )
    expect(first).toEqual(failedPost('Reddit is down', minutesAfter(DAY_ONE_MORNING, 60)))
    expect(second).toEqual(failedPost('Reddit is down', minutesAfter(DAY_ONE_MORNING, 180)))
    expect(third).toEqual(failedPost('Reddit is down', null))
    expect(postCount).toBe(0)
  })

  it('reports the failure when no retry can be scheduled', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))
    fake.scheduler.runJob.mockRejectedValueOnce(new Error('Scheduler is down'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(failed).toEqual(failedPost('Reddit is down', null))
  })

  it.each([
    ['no data', undefined],
    ['a date the calendar lacks', { date: '2026-02-30', slot: 'morning', attempt: 1 }],
    ['an unknown slot', { date: DAY_ONE, slot: 'noon', attempt: 1 }],
    ['attempt zero', { date: DAY_ONE, slot: 'morning', attempt: 0 }],
    ['an attempt past the last retry', { date: DAY_ONE, slot: 'morning', attempt: 4 }],
    ['an attempt sent as text', { date: DAY_ONE, slot: 'morning', attempt: '1' }],
    [
      'a post ID with a key separator',
      { date: DAY_ONE, slot: 'morning', attempt: 1, post: { id: 't3_a:b', createdAt: DAY_ONE_MORNING.toISOString() } },
    ],
    [
      'a post with no creation time',
      { date: DAY_ONE, slot: 'morning', attempt: 1, post: { id: 't3_post_1' } },
    ],
  ])('rejects a job with %s and changes nothing', async (_label, data) => {
    vi.setSystemTime(DAY_ONE_FIRST_RETRY)

    const rejected = await postTask(RETRY_TASK, { name: 'daily-post-retry', data })

    expect(rejected.status).toBe(400)
    expect(fake.reddit.submitCustomPost).not.toHaveBeenCalled()
    expect(fake.redis.__store.size + fake.redis.__hashStore.size).toBe(0)
  })

  it('is a one-off task in devvit.json, so recurring tasks stay at three', () => {
    const { tasks } = devvitConfig.scheduler
    const recurring = Object.values(tasks).filter((task) => 'cron' in task)

    expect(tasks['daily-post-retry']).toEqual({ endpoint: RETRY_TASK })
    expect(recurring).toHaveLength(3)
  })
})
