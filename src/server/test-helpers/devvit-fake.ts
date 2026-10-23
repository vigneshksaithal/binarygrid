import { vi } from 'vitest'

// In-memory stand-in for `@devvit/web/server`, shared by server tests through
// `vi.mock('@devvit/web/server', async () =>
//   (await import('./test-helpers/devvit-fake')).createDevvitServerFake())`.
// It implements only the Redis, Reddit, scheduler and settings calls the server code uses,
// each a `vi.fn` that answers as Devvit 0.15's clients do: `get` and `hGet` of a missing
// key give `undefined`, while `mGet` and `hMGet` give `null` in its place.
// A test that drives the fake directly can build it with
// `const fake = await vi.hoisted(async () => (await import(...)).createDevvitServerFake())`
// and mock with `() => fake`, which keeps its types without a cast. That test can also use
// the fake's test controls: `reset`, `setSettings`, `snapshot` and `ttlOf`.

type ZMember = { member: string; score: number }
type ZRangeOptions = { by?: 'rank' | 'score'; reverse?: boolean }
// `expiration` is accepted but neither recorded nor enforced. `expire` records its TTL for
// `ttlOf` but never enforces it either: a test deletes the key to expire it.
type SetOptions = { nx?: boolean; expiration?: Date }
type CustomPostOptions = { subredditName: string; title: string; entry?: string }
type SettingValue = string | number | boolean | string[] | undefined
type ScheduledJob = { name: string; runAt: Date; data?: unknown }
type FakeContext = {
  postId: string | undefined
  userId: string | undefined
  subredditName: string
}

// The post and logged-in player every test starts on. A test sets `context.userId` or
// `context.postId` to `undefined` for a logged-out player or a request outside a post.
export const FAKE_POST_ID = 't3_post_123'
export const FAKE_USER_ID = 't2_user_456'

const defaultContext = (): FakeContext => ({
  postId: FAKE_POST_ID,
  userId: FAKE_USER_ID,
  subredditName: 'binarygrid',
})

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
  const ttlStore = new Map<string, number>()

  // Reads never create a key, as in Redis, so a read-only request leaves `snapshot` unchanged.
  const readZSet = (key: string): ReadonlyMap<string, number> => zsetStore.get(key) ?? new Map()

  const writeZSet = (key: string): Map<string, number> => {
    const existing = zsetStore.get(key)
    if (existing) return existing
    const next = new Map<string, number>()
    zsetStore.set(key, next)
    return next
  }

  const sortedMembers = (key: string, reverse = false): ZMember[] => {
    const entries = Array.from(readZSet(key).entries()).map(([member, score]) => ({
      member,
      score,
    }))
    return entries.sort((a, b) => (reverse ? b.score - a.score : a.score - b.score))
  }

  return {
    get: vi.fn((key: string) => Promise.resolve(redisStore.get(key))),
    mGet: vi.fn((keys: string[]) =>
      Promise.resolve(keys.map((key) => redisStore.get(key) ?? null))
    ),
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
      ttlStore.delete(key)
      return Promise.resolve()
    }),
    expire: vi.fn((key: string, seconds: number) => {
      ttlStore.set(key, seconds)
      return Promise.resolve()
    }),
    incrBy: vi.fn((key: string, amount: number) => {
      const current = Number.parseInt(redisStore.get(key) ?? '0', 10)
      const next = current + amount
      redisStore.set(key, next.toString())
      return Promise.resolve(next)
    }),
    // Like Devvit's client: the number of fields that were new.
    hSet: vi.fn((key: string, value: Record<string, string>) => {
      const hash = hashStore.get(key) ?? {}
      const added = Object.keys(value).filter((field) => !(field in hash)).length
      hashStore.set(key, { ...hash, ...value })
      return Promise.resolve(added)
    }),
    hSetNX: vi.fn((key: string, field: string, value: string) => {
      const hash = hashStore.get(key) ?? {}
      if (field in hash) return Promise.resolve(0)
      hashStore.set(key, { ...hash, [field]: value })
      return Promise.resolve(1)
    }),
    // As in Redis, a hash left with no fields is gone.
    hDel: vi.fn((key: string, fields: string[]) => {
      const hash = { ...(hashStore.get(key) ?? {}) }
      const removed = fields.filter((field) => field in hash)
      for (const field of removed) delete hash[field]
      if (Object.keys(hash).length > 0) hashStore.set(key, hash)
      else hashStore.delete(key)
      return Promise.resolve(removed.length)
    }),
    hGet: vi.fn((key: string, field: string) => Promise.resolve(hashStore.get(key)?.[field])),
    hGetAll: vi.fn((key: string) => Promise.resolve({ ...(hashStore.get(key) ?? {}) })),
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
    // Like Devvit's client: any number of members, answering how many were new.
    zAdd: vi.fn((key: string, ...members: ZMember[]) => {
      const zset = writeZSet(key)
      const added = members.filter(({ member }) => !zset.has(member)).length
      for (const { member, score } of members) zset.set(member, score)
      return Promise.resolve(added)
    }),
    zRank: vi.fn((key: string, member: string) => {
      const index = sortedMembers(key).findIndex((entry) => entry.member === member)
      return Promise.resolve(index >= 0 ? index : undefined)
    }),
    zScore: vi.fn((key: string, member: string) => Promise.resolve(readZSet(key).get(member))),
    zCard: vi.fn((key: string) => Promise.resolve(readZSet(key).size)),
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
    __ttlStore: ttlStore,
    __clearStore: () => {
      redisStore.clear()
      hashStore.clear()
      zsetStore.clear()
      ttlStore.clear()
    },
  }
}

const createRedditFake = () => ({
  submitComment: vi.fn(() => Promise.resolve({ id: 't1_comment_123' })),
  submitCustomPost: vi.fn((_options: CustomPostOptions) => Promise.resolve({ id: 't3_recap_123' })),
  getCurrentUser: vi.fn(() => Promise.resolve({ username: 'testuser' })),
  getCurrentUsername: vi.fn(() => Promise.resolve('testuser')),
  getSnoovatarUrl: vi.fn(
    (_username: string): Promise<string | undefined> => Promise.resolve(undefined)
  ),
  subscribeToCurrentSubreddit: vi.fn(() => Promise.resolve()),
  getNewPosts: vi.fn(() => fakeListing<unknown>([])),
  // Nobody moderates the fake subreddit until a test lists moderators.
  getModerators: vi.fn((_options: { subredditName: string; username?: string }) =>
    fakeListing<unknown>([])
  ),
})

// The installed subreddit settings: none until a test calls `setSettings`, so readers
// fall back to their defaults. A stub such as `settings.getAll.mockResolvedValue` wins.
const createSettingsFake = (installed: ReadonlyMap<string, SettingValue>) => ({
  getAll: vi.fn(
    (): Promise<Record<string, SettingValue>> => Promise.resolve(Object.fromEntries(installed))
  ),
})

// One-off jobs are only recorded: a test reads `runJob.mock.calls` and delivers
// a job by posting its name and data to the task's endpoint.
const createSchedulerFake = () => ({
  runJob: vi.fn((_job: ScheduledJob) => Promise.resolve('job_1')),
})

// Everything stored, in comparable form, so a test can prove a request changed nothing.
const snapshotOf = (redis: ReturnType<typeof createRedisFake>): string =>
  JSON.stringify({
    strings: [...redis.__store],
    hashes: [...redis.__hashStore],
    sortedSets: [...redis.__zsetStore].map(([key, members]) => [key, [...members]]),
    ttls: [...redis.__ttlStore],
  })

// Puts every `vi.fn` in the given parts back to the fake's own implementation, with no calls.
const resetMocks = (...parts: Record<string, unknown>[]): void => {
  for (const part of parts) {
    for (const member of Object.values(part)) {
      if (vi.isMockFunction(member)) member.mockReset()
    }
  }
}

export const createDevvitServerFake = () => {
  const context = defaultContext()
  const installedSettings = new Map<string, SettingValue>()
  const redis = createRedisFake()
  const reddit = createRedditFake()
  const scheduler = createSchedulerFake()
  const settings = createSettingsFake(installedSettings)
  const cache = vi.fn((fn: () => Promise<unknown>) => fn())

  return {
    context,
    cache,
    redis,
    reddit,
    scheduler,
    settings,
    // The server entry hands these to `serve`; tests that import it mock `serve`.
    createServer: () => undefined,
    getServerPort: () => 0,
    // Test controls, which the server code never imports. `reset` is a fresh install:
    // empty Redis, no settings, the default context, and no stubs or recorded calls.
    reset: (): void => {
      redis.__clearStore()
      installedSettings.clear()
      Object.assign(context, defaultContext())
      resetMocks(redis, reddit, scheduler, settings, { cache })
    },
    // Installs settings the way Devvit returns them: a chosen select as a list of one.
    setSettings: (values: Readonly<Record<string, SettingValue>>): void => {
      for (const [name, value] of Object.entries(values)) installedSettings.set(name, value)
    },
    snapshot: (): string => snapshotOf(redis),
    ttlOf: (key: string): number | undefined => redis.__ttlStore.get(key),
  }
}
