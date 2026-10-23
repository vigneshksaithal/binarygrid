import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import { DAILY_DIFFICULTIES } from '../../shared/growth'
import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'
import { generateDailyPuzzle } from './generator'
import { getOrCreatePuzzleSet, readDatePuzzle, storeDatePuzzle } from './puzzle-set'

const DAY = '2026-10-22'
const NEXT_DAY = '2026-10-23'

// Real generated puzzles, seeded so each call site gets a distinct one.
const puzzleFrom = (seed: string) => (difficulty: Difficulty): PuzzleWithGrid =>
  generateDailyPuzzle(seed, difficulty)

const withoutId = ({ size, difficulty, fixed, initial }: PuzzleWithGrid) => ({
  size,
  difficulty,
  fixed,
  initial,
})

beforeEach(() => {
  vi.resetAllMocks()
  fake.redis.__clearStore()
})

describe('getOrCreatePuzzleSet', () => {
  it('generates and stores each tier once for a date, easy to hard', async () => {
    const generate = vi.fn(puzzleFrom('first'))

    const created = await getOrCreatePuzzleSet(DAY, generate)
    const again = await getOrCreatePuzzleSet(DAY, vi.fn(puzzleFrom('second')))

    expect(generate).toHaveBeenCalledTimes(3)
    expect(created).toEqual(DAILY_DIFFICULTIES.map((tier) => withoutId(puzzleFrom('first')(tier))))
    expect(again).toEqual(created)
  })

  it('stores the set under the date, without an ID, since each post adds its own', async () => {
    await getOrCreatePuzzleSet(DAY, puzzleFrom('first'))

    const stored = JSON.parse((await fake.redis.get(`puzzle:set:${DAY}:hard`)) ?? '{}')

    expect(stored).toEqual(withoutId(puzzleFrom('first')('hard')))
    expect(stored).not.toHaveProperty('id')
  })

  it('keeps dates apart', async () => {
    const today = await getOrCreatePuzzleSet(DAY, puzzleFrom('first'))
    const tomorrow = await getOrCreatePuzzleSet(NEXT_DAY, puzzleFrom('second'))

    expect(tomorrow).not.toEqual(today)
    expect(await readDatePuzzle(DAY, 'easy')).toEqual(today[0])
  })

  it('generates only the tiers the date lacks', async () => {
    const storedHard = withoutId(puzzleFrom('earlier')('hard'))
    await storeDatePuzzle(DAY, storedHard)
    const generate = vi.fn(puzzleFrom('first'))

    const set = await getOrCreatePuzzleSet(DAY, generate)

    expect(generate.mock.calls).toEqual([['easy'], ['medium']])
    expect(set[2]).toEqual(storedHard)
  })
})

describe('storeDatePuzzle', () => {
  it('keeps the first puzzle stored for a date and tier', async () => {
    const first = withoutId(puzzleFrom('first')('easy'))
    const second = withoutId(puzzleFrom('second')('easy'))

    expect(await storeDatePuzzle(DAY, first)).toEqual(first)
    expect(await storeDatePuzzle(DAY, second)).toEqual(first)
    expect(await readDatePuzzle(DAY, 'easy')).toEqual(first)
  })

  it('drops the ID of a puzzle it is given', async () => {
    const generated = puzzleFrom('first')('medium')

    expect(await storeDatePuzzle(DAY, generated)).toEqual(withoutId(generated))
  })
})

describe('readDatePuzzle', () => {
  it('returns null for a date with no stored puzzle', async () => {
    expect(await readDatePuzzle(DAY, 'medium')).toBeNull()
  })
})
