/**
 * In-memory stand-in for `@devvit/web/server` in route tests: strings,
 * hashes and sorted sets, TTLs recorded but never enforced, a logged-in
 * player on a post, subreddit settings (`setSettings`), and a pass-through
 * cache. Load it with:
 *
 *   vi.mock('@devvit/web/server', async () =>
 *     (await import('../test-helpers/devvit-server-fake')).devvitServerFake.module)
 */

type SortedSetMember = { member: string; score: number }

type SettingValue = string | number | boolean | string[] | undefined

type FakeContext = {
  postId: string | undefined
  userId: string | undefined
  subredditName: string
}

export const FAKE_POST_ID = 't3_fakepost'
export const FAKE_USER_ID = 't2_fakeuser'
const FAKE_USERNAME = 'fake_solver'

const defaultContext = (): FakeContext => ({
  postId: FAKE_POST_ID,
  userId: FAKE_USER_ID,
  subredditName: 'binarygrid',
})

const createDevvitServerFake = () => {
  const strings = new Map<string, string>()
  const hashes = new Map<string, Map<string, string>>()
  const sortedSets = new Map<string, Map<string, number>>()
  const ttls = new Map<string, number>()
  const context = defaultContext()
  // The installed subreddit settings: none set until a test calls setSettings.
  const settingValues = new Map<string, SettingValue>()

  const hashAt = (key: string): Map<string, string> => {
    const hash = hashes.get(key) ?? new Map<string, string>()
    hashes.set(key, hash)
    return hash
  }

  const sortedSetAt = (key: string): Map<string, number> => {
    const set = sortedSets.get(key) ?? new Map<string, number>()
    sortedSets.set(key, set)
    return set
  }

  const byScore = (key: string): SortedSetMember[] =>
    [...(sortedSets.get(key) ?? [])]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score)

  const redis = {
    get: async (key: string): Promise<string | undefined> => strings.get(key),
    mGet: async (keys: string[]): Promise<(string | null)[]> =>
      keys.map((key) => strings.get(key) ?? null),
    // Like Devvit's client: 'OK' once written, '' when `nx` finds the key taken.
    set: async (key: string, value: string, options?: { nx?: boolean }): Promise<string> => {
      if (options?.nx && strings.has(key)) return ''
      strings.set(key, value)
      return 'OK'
    },
    incrBy: async (key: string, value: number): Promise<number> => {
      const next = Number(strings.get(key) ?? '0') + value
      strings.set(key, `${next}`)
      return next
    },
    expire: async (key: string, seconds: number): Promise<void> => {
      ttls.set(key, seconds)
    },
    hGet: async (key: string, field: string): Promise<string | undefined> =>
      hashes.get(key)?.get(field),
    hGetAll: async (key: string): Promise<Record<string, string>> =>
      Object.fromEntries(hashes.get(key) ?? []),
    hMGet: async (key: string, fields: string[]): Promise<(string | null)[]> =>
      fields.map((field) => hashes.get(key)?.get(field) ?? null),
    hSet: async (key: string, fieldValues: Record<string, string>): Promise<number> => {
      const hash = hashAt(key)
      const added = Object.keys(fieldValues).filter((field) => !hash.has(field)).length
      for (const [field, value] of Object.entries(fieldValues)) hash.set(field, value)
      return added
    },
    hSetNX: async (key: string, field: string, value: string): Promise<number> => {
      const hash = hashAt(key)
      if (hash.has(field)) return 0
      hash.set(field, value)
      return 1
    },
    hDel: async (key: string, fields: string[]): Promise<number> => {
      const hash = hashes.get(key)
      const removed = fields.filter((field) => hash?.delete(field)).length
      if (hash?.size === 0) hashes.delete(key)
      return removed
    },
    hIncrBy: async (key: string, field: string, value: number): Promise<number> => {
      const hash = hashAt(key)
      const next = Number(hash.get(field) ?? '0') + value
      hash.set(field, `${next}`)
      return next
    },
    zAdd: async (key: string, ...members: SortedSetMember[]): Promise<number> => {
      const set = sortedSetAt(key)
      const added = members.filter(({ member }) => !set.has(member)).length
      for (const { member, score } of members) set.set(member, score)
      return added
    },
    zScore: async (key: string, member: string): Promise<number | undefined> =>
      sortedSets.get(key)?.get(member),
    zRank: async (key: string, member: string): Promise<number | undefined> => {
      const index = byScore(key).findIndex((entry) => entry.member === member)
      return index >= 0 ? index : undefined
    },
    zCard: async (key: string): Promise<number> => sortedSets.get(key)?.size ?? 0,
    zRange: async (
      key: string,
      start: number,
      stop: number,
      options?: { by?: 'rank' | 'score'; reverse?: boolean }
    ): Promise<SortedSetMember[]> => {
      const members = options?.reverse ? byScore(key).reverse() : byScore(key)
      if (options?.by === 'score') {
        return members.filter(({ score }) => score >= start && score <= stop)
      }
      const last = stop < 0 ? members.length + stop : stop
      return members.slice(start, last + 1)
    },
  }

  const reddit = {
    getCurrentUser: async (): Promise<{ username: string } | undefined> => ({
      username: FAKE_USERNAME,
    }),
    getCurrentUsername: async (): Promise<string | undefined> => FAKE_USERNAME,
    getSnoovatarUrl: async (_username: string): Promise<string | undefined> => undefined,
  }

  const cache = async <T>(closure: () => Promise<T>, _options: unknown): Promise<T> => closure()

  const settings = {
    getAll: async (): Promise<Record<string, SettingValue>> => Object.fromEntries(settingValues),
  }

  const reset = (): void => {
    strings.clear()
    hashes.clear()
    sortedSets.clear()
    ttls.clear()
    settingValues.clear()
    Object.assign(context, defaultContext())
  }

  // Sets installed settings the way Devvit returns them: a chosen select as a list of one.
  const setSettings = (values: Readonly<Record<string, SettingValue>>): void => {
    for (const [name, value] of Object.entries(values)) settingValues.set(name, value)
  }

  // Everything stored, in comparable form, so a test can prove a request changed nothing.
  const snapshot = (): string =>
    JSON.stringify({
      strings: [...strings],
      hashes: [...hashes].map(([key, hash]) => [key, [...hash]]),
      sortedSets: [...sortedSets].map(([key, set]) => [key, [...set]]),
      ttls: [...ttls],
    })

  return {
    module: { cache, context, reddit, redis, settings },
    reset,
    setSettings,
    snapshot,
    ttlOf: (key: string): number | undefined => ttls.get(key),
  }
}

export const devvitServerFake = createDevvitServerFake()
