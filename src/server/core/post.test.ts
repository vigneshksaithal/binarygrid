import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import { DAILY_DIFFICULTIES } from '../../shared/growth'
import app from '../routes/index'
import { createPost } from './post'
import { readPostPuzzle } from './post-puzzle'
import { getOrCreatePuzzleNumber, readIndexedPost, readPostStamp } from './puzzle-number'
import { readDatePuzzle } from './puzzle-set'

const MORNING = new Date('2026-10-22T08:00:00.000Z')
const AFTERNOON = new Date('2026-10-22T15:30:00.000Z')
const EVENING = new Date('2026-10-22T20:00:00.000Z')
const LAST_SECOND = new Date('2026-10-22T23:59:59.000Z')
const AFTER_MIDNIGHT = new Date('2026-10-23T00:00:01.000Z')
const NEXT_MORNING = new Date('2026-10-23T08:00:00.000Z')

const nextPostId = (id: string) => fake.reddit.submitCustomPost.mockResolvedValueOnce({ id })

// Creates a post the way a scheduled task or menu click does at that moment.
const createPostAt = async (now: Date, id: string) => {
  vi.setSystemTime(now)
  nextPostId(id)
  return createPost(now)
}

const postedTitles = () =>
  fake.reddit.submitCustomPost.mock.calls.map(([options]) => options.title)

const fetchPuzzleNumber = async (postId: string) => {
  fake.context.postId = postId
  const response = await app.fetch(new Request('http://localhost/api/puzzle-number'))
  return response.json()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  fake.redis.__clearStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createPost', () => {
  it('titles each post "Binary Grid #N" with no Morning or Evening suffix', async () => {
    await createPostAt(MORNING, 't3_morning')
    await createPostAt(EVENING, 't3_evening')
    await createPostAt(NEXT_MORNING, 't3_next')

    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #1', 'Binary Grid #2'])
    expect(fake.reddit.submitCustomPost).toHaveBeenCalledWith({
      subredditName: 'binarygrid',
      title: 'Binary Grid #1',
      entry: 'default',
    })
  })

  it("stores the post's number, creation time and index before it returns", async () => {
    const post = await createPostAt(MORNING, 't3_daily')

    expect(post.id).toBe('t3_daily')
    expect(await readPostStamp('t3_daily')).toEqual({ number: 1, createdAt: MORNING })
    expect(await readIndexedPost(1)).toEqual({ postId: 't3_daily', createdAt: MORNING })
  })

  it('serves the stamped number from /api/puzzle-number without minting, even a day later', async () => {
    await createPostAt(MORNING, 't3_daily')
    vi.setSystemTime(NEXT_MORNING)

    expect(await fetchPuzzleNumber('t3_daily')).toEqual({ dayNumber: 1 })
    expect(await fake.redis.get('puzzle:number:counter')).toBe('1')
    expect(await fake.redis.get('puzzle:number:date:2026-10-23')).toBeNull()
  })

  it('gives a second post on the same UTC date the same number and puzzles, with its own boards', async () => {
    await createPostAt(MORNING, 't3_daily')
    await createPostAt(AFTERNOON, 't3_menu')

    for (const difficulty of DAILY_DIFFICULTIES) {
      const daily = await readPostPuzzle('t3_daily', difficulty)
      const menu = await readPostPuzzle('t3_menu', difficulty)
      expect(menu?.fixed).toEqual(daily?.fixed)
      expect(menu?.initial).toEqual(daily?.initial)
      // Puzzle IDs name the boards (leaderboard:{puzzleId}), so each post keeps its own.
      expect(daily?.id).toBe(`t3_daily:${difficulty}`)
      expect(menu?.id).toBe(`t3_menu:${difficulty}`)
    }
    expect(await readPostStamp('t3_menu')).toEqual({ number: 1, createdAt: AFTERNOON })
    expect(await readIndexedPost(1)).toEqual({ postId: 't3_daily', createdAt: MORNING })
    expect(await fetchPuzzleNumber('t3_menu')).toEqual({ dayNumber: 1 })
  })

  it("stores the date's puzzle set from the date's first post", async () => {
    await createPostAt(MORNING, 't3_daily')

    for (const difficulty of DAILY_DIFFICULTIES) {
      const served = await readPostPuzzle('t3_daily', difficulty)
      expect(await readDatePuzzle('2026-10-22', difficulty)).toEqual({
        size: served?.size,
        difficulty,
        fixed: served?.fixed,
        initial: served?.initial,
      })
    }
  })

  it('gives consecutive dates consecutive numbers and their own puzzles', async () => {
    await createPostAt(MORNING, 't3_day_one')
    await createPostAt(NEXT_MORNING, 't3_day_two')

    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #2'])
    expect((await readPostPuzzle('t3_day_two', 'hard'))?.initial).not.toEqual(
      (await readPostPuzzle('t3_day_one', 'hard'))?.initial
    )
  })

  it("gives a post created just after midnight UTC the new date's number", async () => {
    await createPostAt(LAST_SECOND, 't3_late')
    await createPostAt(AFTER_MIDNIGHT, 't3_early')

    expect(postedTitles()).toEqual(['Binary Grid #1', 'Binary Grid #2'])
    expect(await readPostStamp('t3_early')).toEqual({ number: 2, createdAt: AFTER_MIDNIGHT })
  })

  it('reuses the number an older post took lazily earlier that date', async () => {
    // A pre-stamping post first solved at 01:00 already minted the date's number.
    await getOrCreatePuzzleNumber('t3_legacy', '2026-10-22')

    await createPostAt(MORNING, 't3_daily')

    expect(postedTitles()).toEqual(['Binary Grid #1'])
    expect(await fake.redis.get('puzzle:number:counter')).toBe('1')
    expect(await readIndexedPost(1)).toEqual({ postId: 't3_daily', createdAt: MORNING })
  })
})
