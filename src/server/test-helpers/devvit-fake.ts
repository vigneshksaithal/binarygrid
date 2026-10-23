import { vi } from 'vitest'

// In-memory stand-in for `@devvit/web/server`, shared by server tests through
// `vi.mock('@devvit/web/server', async () =>
//   (await import('./test-helpers/devvit-fake')).createDevvitServerFake())`.
// It implements only the Redis, Reddit, scheduler and settings calls the server code uses.
// A test that drives the fake directly can build it with
// `const fake = await vi.hoisted(async () => (await import(...)).createDevvitServerFake())`
// and mock with `() => fake`, which keeps its types without a cast.

type ZMember = { member: string; score: number }
type ZRangeOptions = { by?: 'rank' | 'score'; reverse?: boolean }
// `expiration` is accepted but never enforced, like `expire`: a test deletes the key to expire it.
type SetOptions = { nx?: boolean; expiration?: Date }
type CustomPostOptions = { subredditName: string; title: string; entry?: string }
type SettingValue = string | number | boolean | string[] | undefined
type ScheduledJob = { name: string; runAt: Date; data?: unknown }

const toAsyncIterator = <T>(items: readonly T[]): AsyncIterator<T> => {
  let index = 0
  return {
    next: () => {
      const value = items[index]
      index += 1
      return Promise.resolve(
        value === undefined ? { done: true, value: undefined } : { done: false, value }
      )
    },
  }
}

// Mirrors the iterable `Listing` that Reddit list calls such as `getNewPosts` return.
export const fakeListing = <T>(items: readonly T[]) => ({
  all: () => Promise.resolve([...items]),
  [Symbol.asyncIterator]: () => toAsyncIterator(items),
})

// Redis rank ranges are inclusive and accept negative indexes from the end.
const sliceByRank = <T>(items: readonly T[], start: number, stop: number): T[] => {
  const from = start < 0 ? Math.max(items.length + start, 0) : start
  const to = stop < 0 ? items.length + stop : stop
  return items.slice(from, to + 1)
}

const createRedisFake = () => {
  const redisStore = new Map<string, string>()
  const hashStore = new Map<string, Record<string, string>>()
  const zsetStore = new Map<string, Map<string, number>>()

  const getZSet = (key: string): Map<string, number> => {
    const existing = zsetStore.get(key)
    if (existing) return existing
    const next = new Map<string, number>()
    zsetStore.set(key, next)
    return next
  }

  const sortedMembers = (key: string, reverse = false): ZMember[] => {
    const entries = Array.from(getZSet(key).entries()).map(([member, score]) => ({
      member,
      score,
    }))
    return entries.sort((a, b) => (reverse ? b.score - a.score : a.score - b.score))
  }

  return {
    get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    // Like Devvit's client: 'OK' once written, '' when `nx` finds the key taken.
    set: vi.fn((key: string, value: string, options?: SetOptions) => {
      if (options?.nx && redisStore.has(key)) return Promise.resolve('')
      redisStore.set(key, value)
      return Promise.resolve('OK')
    }),
    del: vi.fn((key: string) => {
      redisStore.delete(key)
      hashStore.delete(key)
      zsetStore.delete(key)
      return Promise.resolve()
    }),
    expire: vi.fn(() => Promise.resolve()),
    incrBy: vi.fn((key: string, amount: number) => {
      const current = Number.parseInt(redisStore.get(key) ?? '0', 10)
      const next = current + amount
      redisStore.set(key, next.toString())
      return Promise.resolve(next)
    }),
    hSet: vi.fn((key: string, value: Record<string, string>) => {
      hashStore.set(key, { ...(hashStore.get(key) ?? {}), ...value })
      return Promise.resolve()
    }),
    hSetNX: vi.fn((key: string, field: string, value: string) => {
      const hash = hashStore.get(key) ?? {}
      if (field in hash) return Promise.resolve(0)
      hashStore.set(key, { ...hash, [field]: value })
      return Promise.resolve(1)
    }),
    hDel: vi.fn((key: string, fields: string[]) => {
      const hash = { ...(hashStore.get(key) ?? {}) }
      const removed = fields.filter((field) => field in hash)
      for (const field of removed) delete hash[field]
      hashStore.set(key, hash)
      return Promise.resolve(removed.length)
    }),
    hGet: vi.fn((key: string, field: string) =>
      Promise.resolve(hashStore.get(key)?.[field] ?? null)
    ),
    hGetAll: vi.fn((key: string) => Promise.resolve(hashStore.get(key) ?? {})),
    hKeys: vi.fn((key: string) => Promise.resolve(Object.keys(hashStore.get(key) ?? {}))),
    hMGet: vi.fn((key: string, fields: string[]) =>
      Promise.resolve(fields.map((field) => hashStore.get(key)?.[field] ?? null))
    ),
    hIncrBy: vi.fn((key: string, field: string, amount: number) => {
      const hash = hashStore.get(key) ?? {}
      const next = Number.parseInt(hash[field] ?? '0', 10) + amount
      hashStore.set(key, { ...hash, [field]: next.toString() })
      return Promise.resolve(next)
    }),
    zAdd: vi.fn((key: string, entry: ZMember) => {
      getZSet(key).set(entry.member, entry.score)
      return Promise.resolve()
    }),
    zRank: vi.fn((key: string, member: string) => {
      const index = sortedMembers(key).findIndex((entry) => entry.member === member)
      return Promise.resolve(index >= 0 ? index : undefined)
    }),
    zScore: vi.fn((key: string, member: string) => Promise.resolve(getZSet(key).get(member))),
    zCard: vi.fn((key: string) => Promise.resolve(getZSet(key).size)),
    zRange: vi.fn((key: string, start: number, stop: number, options?: ZRangeOptions) => {
      const members = sortedMembers(key, options?.reverse)
      if (options?.by === 'score') {
        return Promise.resolve(
          members.filter((entry) => entry.score >= start && entry.score <= stop)
        )
      }
      return Promise.resolve(sliceByRank(members, start, stop))
    }),
    __store: redisStore,
    __hashStore: hashStore,
    __zsetStore: zsetStore,
    __clearStore: () => {
      redisStore.clear()
      hashStore.clear()
      zsetStore.clear()
    },
  }
}

const createRedditFake = () => ({
  submitComment: vi.fn(() => Promise.resolve({ id: 't1_comment_123' })),
  submitCustomPost: vi.fn((_options: CustomPostOptions) => Promise.resolve({ id: 't3_recap_123' })),
  getCurrentUser: vi.fn(() => Promise.resolve({ username: 'testuser' })),
  getCurrentUsername: vi.fn(() => Promise.resolve('testuser')),
  getSnoovatarUrl: vi.fn(() => Promise.resolve(null)),
  subscribeToCurrentSubreddit: vi.fn(() => Promise.resolve()),
  getNewPosts: vi.fn(() => fakeListing<unknown>([])),
  // Nobody moderates the fake subreddit until a test lists moderators.
  getModerators: vi.fn((_options: { subredditName: string; username?: string }) =>
    fakeListing<unknown>([])
  ),
})

// The installed subreddit settings: none set, so readers fall back to their
// defaults. A test sets values with `settings.getAll.mockResolvedValue`.
const createSettingsFake = () => ({
  getAll: vi.fn((): Promise<Record<string, SettingValue>> => Promise.resolve({})),
})

// One-off jobs are only recorded: a test reads `runJob.mock.calls` and delivers
// a job by posting its name and data to the task's endpoint.
const createSchedulerFake = () => ({
  runJob: vi.fn((_job: ScheduledJob) => Promise.resolve('job_1')),
})

export const createDevvitServerFake = () => ({
  context: {
    postId: 't3_post_123',
    userId: 't2_user_456',
    subredditName: 'binarygrid',
  },
  cache: vi.fn((fn: () => Promise<unknown>) => fn()),
  redis: createRedisFake(),
  reddit: createRedditFake(),
  scheduler: createSchedulerFake(),
  settings: createSettingsFake(),
  // The server entry hands these to `serve`; tests that import it mock `serve`.
  createServer: () => undefined,
  getServerPort: () => 0,
})
