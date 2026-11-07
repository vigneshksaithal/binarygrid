import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)
// Real generators, watched, so a test can tell whether createPost generated anything.
vi.mock('./generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./generator')>()
  return {
    ...actual,
    generatePuzzleForDate: vi.fn(actual.generatePuzzleForDate),
    generatePuzzleForPost: vi.fn(actual.generatePuzzleForPost),
  }
})

import { DAILY_DIFFICULTIES } from '../../shared/growth'
import { solvePuzzle } from '../../shared/solver'
import app from '../routes/index'
import { generatePuzzleForDate, generatePuzzleForPost } from './generator'
import { completePost, createPost, createPostForDate, preparePuzzleSet } from './post'
import { readPostPuzzle } from './post-puzzle'
import {
  getOrCreateDateNumber,
  getOrCreatePuzzleNumber,
  readIndexedPost,
  readPostStamp,
} from './puzzle-number'
import { readDatePuzzle } from './puzzle-set'

const DAY = '2026-10-22'
const NEXT_DAY = '2026-10-23'
const DAY_BEFORE_MORNING = new Date('2026-10-21T08:00:00.000Z')
const MORNING = new Date('2026-10-22T08:00:00.000Z')
const RETRY_TIME = new Date('2026-10-22T08:15:00.000Z')
const AFTERNOON = new Date('2026-10-22T15:30:00.000Z')
const EVENING = new Date('2026-10-22T20:00:00.000Z')
const LAST_SECOND = new Date('2026-10-22T23:59:59.000Z')
const AFTER_MIDNIGHT = new Date('2026-10-23T00:00:01.000Z')
const LATE_RETRY_TIME = new Date('2026-10-23T00:30:00.000Z')
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
    expect(await fake.redis.get('puzzle:number:date:2026-10-23')).toBeUndefined()
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

  it('serves a set stored ahead for its date and generates nothing', async () => {
    // The day before's daily run stored this date's set.
    vi.setSystemTime(DAY_BEFORE_MORNING)
    await preparePuzzleSet(DAY)
    vi.mocked(generatePuzzleForDate).mockClear()

    await createPostAt(MORNING, 't3_daily')

    expect(generatePuzzleForPost).not.toHaveBeenCalled()
    expect(generatePuzzleForDate).not.toHaveBeenCalled()
    for (const difficulty of DAILY_DIFFICULTIES) {
      const served = await readPostPuzzle('t3_daily', difficulty)
      const stored = await readDatePuzzle(DAY, difficulty)
      expect(served?.initial).toEqual(stored?.initial)
      expect(served?.fixed).toEqual(stored?.fixed)
      expect(served?.id).toBe(`t3_daily:${difficulty}`)
    }
  })

  it('prepares the date puzzles before publishing the first post', async () => {
    await createPostAt(MORNING, 't3_daily')

    expect(vi.mocked(generatePuzzleForDate).mock.calls).toEqual(
      DAILY_DIFFICULTIES.map((difficulty) => [DAY, difficulty])
    )
    expect(generatePuzzleForPost).not.toHaveBeenCalled()
  })
})

describe('createPostForDate', () => {
  it('shows the intended number before stamping when a retry posts after midnight', async () => {
    await getOrCreateDateNumber(DAY)
    await getOrCreateDateNumber(NEXT_DAY)
    vi.setSystemTime(LATE_RETRY_TIME)
    nextPostId('t3_late')
    fake.reddit.getPostById.mockResolvedValue({ title: 'Binary Grid #1' })
    let number: unknown
    await createPostForDate(DAY, LATE_RETRY_TIME, async () => {
      number = await fetchPuzzleNumber('t3_late')
    })
    expect(number).toEqual({ dayNumber: 1 })
    expect(await fetchPuzzleNumber('t3_late')).toEqual({ dayNumber: 1 })
  })

  it('serves the intended date set before setup finishes, even after midnight', async () => {
    vi.setSystemTime(LATE_RETRY_TIME)
    nextPostId('t3_late')
    fake.reddit.getPostById.mockResolvedValue({ title: 'Binary Grid #1' })
    fake.context.postId = 't3_late'
    let opened: { puzzle: import('../../shared/types/puzzle').PuzzleWithGrid } | undefined
    await createPostForDate(DAY, LATE_RETRY_TIME, async () => {
      opened = await (await app.request('/api/puzzle?difficulty=easy')).json()
    })
    expect(opened?.puzzle.initial).toEqual((await readDatePuzzle(DAY, 'easy'))?.initial)
    expect((await readPostPuzzle('t3_late', 'easy'))?.initial).toEqual(opened?.puzzle.initial)
    if (!opened) throw new Error('Puzzle did not load')
    const response = await app.request('/api/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: opened.puzzle.id, attemptId: '3d6f0a9c-8e21-4b57-b0c4-5f1e7a2d9c63',
        grid: solvePuzzle(opened.puzzle.initial, opened.puzzle.fixed), solveTimeSeconds: 120 }),
    })
    expect(await response.json()).toMatchObject({ ok: true })
  })
  it("posts for the date it is given after midnight, with that date's number and puzzles", async () => {
    // The day's run minted #1 before Reddit turned its post down.
    await getOrCreateDateNumber(DAY)
    vi.setSystemTime(LATE_RETRY_TIME)
    nextPostId('t3_late')

    await createPostForDate(DAY, LATE_RETRY_TIME)

    expect(postedTitles()).toEqual(['Binary Grid #1'])
    expect(await readPostStamp('t3_late')).toEqual({ number: 1, createdAt: LATE_RETRY_TIME })
    expect(await fake.redis.get(`puzzle:number:date:${NEXT_DAY}`)).toBeUndefined()
    for (const difficulty of DAILY_DIFFICULTIES) {
      expect((await readPostPuzzle('t3_late', difficulty))?.initial).toEqual(
        (await readDatePuzzle(DAY, difficulty))?.initial
      )
    }
  })
})

describe('completePost', () => {
  // Reddit accepted the post, then the run stopped before storing anything for it.
  const postWithoutPuzzles = async (postId: string) => {
    vi.setSystemTime(MORNING)
    nextPostId(postId)
    await expect(
      createPostForDate(DAY, MORNING, () => Promise.reject(new Error('Redis write failed')))
    ).rejects.toThrow('Redis write failed')
  }

  it('registers the intended date while preserving a pre-upgrade post’s served tier', async () => {
    await postWithoutPuzzles('t3_daily')
    await fake.redis.del('puzzle:number:published-date:1')
    const served = { ...generatePuzzleForDate('2026-10-23', 'easy'), id: 't3_daily:easy' }
    await fake.redis.hSet('post:t3_daily:puzzle:easy', {
      id: served.id, difficulty: served.difficulty, size: String(served.size),
      fixed: JSON.stringify(served.fixed), initial: JSON.stringify(served.initial),
    })
    await completePost('t3_daily', DAY, MORNING)
    expect(await fake.redis.get('puzzle:number:published-date:1')).toBe(DAY)
    expect((await readPostPuzzle('t3_daily', 'easy'))?.initial).toEqual(served.initial)
    expect((await readPostPuzzle('t3_daily', 'hard'))?.initial).toEqual((await readDatePuzzle(DAY, 'hard'))?.initial)
  })

  it('stamps and stores the date\'s puzzles for a post left without them, posting nothing', async () => {
    await postWithoutPuzzles('t3_daily')
    vi.setSystemTime(RETRY_TIME)

    await completePost('t3_daily', DAY, MORNING)

    expect(fake.reddit.submitCustomPost).toHaveBeenCalledTimes(1)
    expect(await readPostStamp('t3_daily')).toEqual({ number: 1, createdAt: MORNING })
    expect(await readIndexedPost(1)).toEqual({ postId: 't3_daily', createdAt: MORNING })
    for (const difficulty of DAILY_DIFFICULTIES) {
      const served = await readPostPuzzle('t3_daily', difficulty)
      expect(served?.id).toBe(`t3_daily:${difficulty}`)
      expect(served?.initial).toEqual((await readDatePuzzle(DAY, difficulty))?.initial)
    }
  })

  it('keeps a puzzle the post already served before it was finished', async () => {
    await postWithoutPuzzles('t3_daily')
    // A player opened Easy in the meantime, so the post stored the fallback grid.
    fake.context.postId = 't3_daily'
    const opened = await app.fetch(new Request('http://localhost/api/puzzle?difficulty=easy'))
    const { puzzle: servedEasy } = await opened.json()

    await completePost('t3_daily', DAY, MORNING)

    expect((await readDatePuzzle(DAY, 'easy'))?.initial).not.toEqual(servedEasy.initial)
    expect((await readPostPuzzle('t3_daily', 'easy'))?.initial).toEqual(servedEasy.initial)
    expect((await readPostPuzzle('t3_daily', 'hard'))?.initial).toEqual(
      (await readDatePuzzle(DAY, 'hard'))?.initial
    )
  })

  it('keeps the stamp a post already has', async () => {
    // The stamp was stored, then storing the puzzles failed.
    fake.redis.hSetNX.mockRejectedValueOnce(new Error('Redis write failed'))
    await expect(createPostAt(MORNING, 't3_daily')).rejects.toThrow('Redis write failed')

    await completePost('t3_daily', DAY, RETRY_TIME)

    expect(await readPostStamp('t3_daily')).toEqual({ number: 1, createdAt: MORNING })
    expect(await readPostPuzzle('t3_daily', 'hard')).not.toBeNull()
  })

  it('changes nothing on a post that has everything', async () => {
    await createPostAt(MORNING, 't3_daily')
    const before = JSON.stringify([...fake.redis.__store, ...fake.redis.__hashStore])

    await completePost('t3_daily', DAY, RETRY_TIME)

    expect(JSON.stringify([...fake.redis.__store, ...fake.redis.__hashStore])).toBe(before)
    expect(fake.reddit.submitComment).toHaveBeenCalledTimes(1)
  })
})

describe('preparePuzzleSet', () => {
  it("stores a date's puzzles ahead, generated for that date, once", async () => {
    vi.setSystemTime(MORNING)

    await preparePuzzleSet(NEXT_DAY)
    await preparePuzzleSet(NEXT_DAY)

    expect(vi.mocked(generatePuzzleForDate).mock.calls).toEqual(
      DAILY_DIFFICULTIES.map((difficulty) => [NEXT_DAY, difficulty])
    )
    for (const difficulty of DAILY_DIFFICULTIES) {
      expect(await readDatePuzzle(NEXT_DAY, difficulty)).not.toBeNull()
    }
  })
})
