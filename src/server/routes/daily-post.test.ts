import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import devvitConfig from '../../../devvit.json'
import { createPost } from '../core/post'
import app from './index'

const MORNING_TASK = '/internal/schedule/daily-morning'
const EVENING_TASK = '/internal/schedule/daily-evening'

const DAY_ONE_EARLY = new Date('2026-10-22T06:00:00.000Z')
const DAY_ONE_MORNING = new Date('2026-10-22T08:00:00.000Z')
const DAY_ONE_EVENING = new Date('2026-10-22T20:00:00.000Z')
const DAY_TWO_MORNING = new Date('2026-10-23T08:00:00.000Z')
const DAY_TWO_EVENING = new Date('2026-10-23T20:00:00.000Z')

let postCount = 0

const useSlot = (slot: string) =>
  fake.settings.getAll.mockResolvedValue({ dailyPostSlot: [slot] })

// Runs a scheduler task the way Devvit does: a POST with the task name, at the cron's time.
const runTask = async (path: string, at: Date) => {
  vi.setSystemTime(at)
  const name = path === MORNING_TASK ? 'daily-post-morning' : 'daily-post-evening'
  const response = await app.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  )
  return { status: response.status, body: await response.json() }
}

const postedTitles = () =>
  fake.reddit.submitCustomPost.mock.calls.map(([options]) => options.title)

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  fake.redis.__clearStore()
  postCount = 0
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

    expect(morning).toEqual({ status: 200, body: { status: 'posted', postId: 't3_post_1' } })
    expect(evening).toEqual({ status: 200, body: { status: 'skipped', reason: 'other_slot' } })
    expect(postedTitles()).toEqual(['Binary Grid #1'])
  })

  it('posts from the evening task when dailyPostSlot is evening', async () => {
    useSlot('evening')

    const morning = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const evening = await runTask(EVENING_TASK, DAY_ONE_EVENING)

    expect(morning.body).toEqual({ status: 'skipped', reason: 'other_slot' })
    expect(evening.body).toEqual({ status: 'posted', postId: 't3_post_1' })
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
    expect(nextEvening.body).toEqual({ status: 'posted', postId: 't3_post_2' })
    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #2'])
  })

  it('posts the next morning after the slot moves back to morning', async () => {
    useSlot('evening')
    await runTask(EVENING_TASK, DAY_ONE_EVENING)
    useSlot('morning')

    const nextMorning = await runTask(MORNING_TASK, DAY_TWO_MORNING)
    const nextEvening = await runTask(EVENING_TASK, DAY_TWO_EVENING)

    expect(nextMorning.body).toEqual({ status: 'posted', postId: 't3_post_2' })
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

    expect(morning.body).toEqual({ status: 'posted', postId: 't3_post_2' })
    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #1'])
  })

  it('reports a failed post and lets a later run post for the date', async () => {
    fake.reddit.submitCustomPost.mockRejectedValueOnce(new Error('Reddit is down'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const retried = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(failed).toEqual({
      status: 500,
      body: { status: 'error', message: 'Failed to create daily puzzle post: Reddit is down' },
    })
    expect(retried.body).toEqual({ status: 'posted', postId: 't3_post_1' })
  })

  it('keeps the date for its post when storing the puzzles fails after posting', async () => {
    fake.redis.hSet.mockRejectedValueOnce(new Error('Redis write failed'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    const repeat = await runTask(MORNING_TASK, DAY_ONE_MORNING)
    useSlot('evening')
    const evening = await runTask(EVENING_TASK, DAY_ONE_EVENING)

    expect(failed).toEqual({
      status: 500,
      body: { status: 'error', message: 'Failed to create daily puzzle post: Redis write failed' },
    })
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

  it('posts nothing when the setting cannot be read', async () => {
    fake.settings.getAll.mockRejectedValueOnce(new Error('Could not get installation settings'))

    const failed = await runTask(MORNING_TASK, DAY_ONE_MORNING)

    expect(failed.status).toBe(500)
    expect(fake.reddit.submitCustomPost).not.toHaveBeenCalled()
  })

  it('keeps both daily tasks in devvit.json, each on its own endpoint', () => {
    const { tasks } = devvitConfig.scheduler

    expect(tasks['daily-post-morning']).toEqual({ endpoint: MORNING_TASK, cron: '0 8 * * *' })
    expect(tasks['daily-post-evening']).toEqual({ endpoint: EVENING_TASK, cron: '0 20 * * *' })
  })
})
