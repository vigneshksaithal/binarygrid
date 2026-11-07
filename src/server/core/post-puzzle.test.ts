import { beforeEach, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import { generateDailyPuzzle } from './generator'
import { readPostPuzzle, storePostPuzzle } from './post-puzzle'

beforeEach(() => fake.reset())

it('keeps the first puzzle when two different writers race', async () => {
  const first = { ...generateDailyPuzzle('2026-10-01', 'easy'), id: 't3_race:easy' }
  const second = { ...generateDailyPuzzle('2026-10-02', 'easy'), id: 't3_race:easy' }
  const [a, b] = await Promise.all([
    storePostPuzzle('t3_race', first),
    storePostPuzzle('t3_race', second),
  ])
  expect(a).toEqual(b)
  expect(await readPostPuzzle('t3_race', 'easy')).toEqual(a)
})

it('preserves a legacy stored puzzle when a new writer arrives', async () => {
  const first = { ...generateDailyPuzzle('2026-10-01', 'easy'), id: 't3_old:easy' }
  await fake.redis.hSet('post:t3_old:puzzle:easy', {
    id: first.id, size: '6', difficulty: 'easy', fixed: JSON.stringify(first.fixed),
    initial: JSON.stringify(first.initial),
  })
  const second = { ...generateDailyPuzzle('2026-10-02', 'easy'), id: first.id }
  expect(await storePostPuzzle('t3_old', second)).toEqual(first)
  expect(await readPostPuzzle('t3_old', 'easy')).toEqual(first)
})
