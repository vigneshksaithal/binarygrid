import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import {
  getOrCreateDateNumber,
  getOrCreatePuzzleNumber,
  getPuzzleNumber,
  readIndexedPost,
  readPostStamp,
  stampPost,
} from './puzzle-number'

const DAY = '2026-10-22'
const MENU_TIME = new Date('2026-10-22T06:00:00.000Z')
const MORNING = new Date('2026-10-22T08:00:00.000Z')

beforeEach(() => {
  vi.resetAllMocks()
  fake.redis.__clearStore()
})

describe('getOrCreateDateNumber', () => {
  it('mints one number per UTC date and returns it on every later call', async () => {
    expect(await getOrCreateDateNumber(DAY)).toBe(1)
    expect(await getOrCreateDateNumber(DAY)).toBe(1)
    expect(await fake.redis.get('puzzle:number:counter')).toBe('1')
    expect(await fake.redis.get(`puzzle:number:date:${DAY}`)).toBe('1')
  })

  it('gives consecutive dates consecutive numbers', async () => {
    const numbers = []
    for (const date of ['2026-10-22', '2026-10-23', '2026-10-24']) {
      numbers.push(await getOrCreateDateNumber(date))
    }

    expect(numbers).toEqual([1, 2, 3])
  })

  it('keeps the number another request stored first for the date', async () => {
    await fake.redis.set(`puzzle:number:date:${DAY}`, '7')
    // This request read the date key just before the other request wrote it.
    fake.redis.get.mockResolvedValueOnce(undefined)

    expect(await getOrCreateDateNumber(DAY)).toBe(7)
    expect(await fake.redis.get(`puzzle:number:date:${DAY}`)).toBe('7')
  })
})

describe('stampPost', () => {
  it("stores a post's number and creation time", async () => {
    await stampPost('t3_daily', 4, MORNING)

    expect(await readPostStamp('t3_daily')).toEqual({ number: 4, createdAt: MORNING })
    expect(await getPuzzleNumber('t3_daily')).toBe(4)
  })

  it('keeps the first post stamped with a number as its indexed post', async () => {
    await stampPost('t3_menu', 1, MENU_TIME)
    await stampPost('t3_daily', 1, MORNING)

    expect(await readIndexedPost(1)).toEqual({ postId: 't3_menu', createdAt: MENU_TIME })
    expect(await readPostStamp('t3_daily')).toEqual({ number: 1, createdAt: MORNING })
  })

  it('finds no indexed post for a number no post was stamped with', async () => {
    await stampPost('t3_daily', 1, MORNING)

    expect(await readIndexedPost(2)).toBeNull()
  })
})

describe('getOrCreatePuzzleNumber, the fallback for posts created before stamping', () => {
  it("returns a stamped post's number on a later date without minting", async () => {
    await stampPost('t3_daily', 5, MORNING)

    expect(await getOrCreatePuzzleNumber('t3_daily', '2026-10-23')).toBe(5)
    expect(await fake.redis.get('puzzle:number:counter')).toBeUndefined()
    expect(await fake.redis.get('puzzle:number:date:2026-10-23')).toBeUndefined()
  })

  it("gives an older post the date's number through the date key, unstamped", async () => {
    const dateNumber = await getOrCreateDateNumber(DAY)

    expect(await getOrCreatePuzzleNumber('t3_legacy', DAY)).toBe(dateNumber)
    expect(await getPuzzleNumber('t3_legacy')).toBe(dateNumber)
    expect(await readPostStamp('t3_legacy')).toBeNull()
    expect(await fake.redis.get('puzzle:number:counter')).toBe('1')
  })

  it('mints the date number when an older post is the first seen that date', async () => {
    expect(await getOrCreatePuzzleNumber('t3_legacy', DAY)).toBe(1)
    expect(await getOrCreateDateNumber(DAY)).toBe(1)
  })
})
