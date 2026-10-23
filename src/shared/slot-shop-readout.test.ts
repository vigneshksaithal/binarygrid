import { describe, expect, it } from 'vitest'
import { addDays, buildPostSection, type DatedFields, listDates, type PostSlot } from './baseline'
import {
  averageOpeners,
  formatSlotShopReadout,
  median,
  summarizeSlots,
} from './slot-shop-readout'

type FixturePost = { id: string; slot: PostSlot; solvers: number }

// Builds a post section with the nightly job's own writer, so the readout is
// tested against the stored format rather than a hand-written copy of it.
const postSection = (posts: readonly FixturePost[]) =>
  buildPostSection(
    posts.map(({ id, slot, solvers }) => ({
      id,
      slot,
      hour: slot === 'Evening' ? 20 : 8,
      tierSolvers: { easy: solvers, medium: 0, hard: 0 },
      uniqueSolvers: solvers,
      subFloor: 0,
    }))
  )

// One post a day from `first`, with the given unique solver counts.
const dailyPosts = (slot: PostSlot, first: string, solvers: readonly number[]): DatedFields[] =>
  solvers.map((count, index) => {
    const date = addDays(first, index)
    return { date, fields: postSection([{ id: `t3_${slot}_${date}`, slot, solvers: count }]) }
  })

const recordedDay = (date: string, shopOpen: number, appOpen: number): DatedFields => ({
  date,
  fields: {
    app_open: String(appOpen),
    shop_open: String(shopOpen),
    recorded_at: `${addDays(date, 1)}T00:30:00.000Z`,
  },
})

const POSTS_THROUGH = '2026-10-14'
// 2026-10-14 minus 55 days: the first of the 56 days that end on the post cursor.
const SLOT_WINDOW_START = '2026-08-20'
const FOURTEEN_COUNTS = Array.from({ length: 14 }, (_, index) => index + 1)

describe('median', () => {
  it('takes the middle value of an odd count, in any order', () => {
    expect(median([9, 1, 5])).toBe(5)
  })

  it('averages the two middle values of an even count', () => {
    expect(median([10, 1, 7, 4])).toBe(5.5)
  })

  it('returns null without values', () => {
    expect(median([])).toBeNull()
  })
})

describe('summarizeSlots', () => {
  it('counts posts and takes the median unique solvers per post for each slot', () => {
    const records = [
      {
        date: '2026-10-01',
        fields: postSection([
          { id: 't3_m1', slot: 'Morning', solvers: 3 },
          { id: 't3_e1', slot: 'Evening', solvers: 1 },
        ]),
      },
      {
        date: '2026-10-02',
        fields: postSection([
          { id: 't3_m2', slot: 'Morning', solvers: 10 },
          { id: 't3_m3', slot: 'Morning', solvers: 4 },
          { id: 't3_e2', slot: 'Evening', solvers: 2 },
        ]),
      },
    ]

    expect(summarizeSlots(records)).toEqual([
      { slot: 'Morning', posts: 3, median: 4 },
      { slot: 'Evening', posts: 2, median: 1.5 },
    ])
  })

  it('skips single-post days, other fields and post records it cannot read', () => {
    const records = [
      {
        date: '2026-02-01',
        fields: {
          ...postSection([{ id: 't3_single', slot: 'single', solvers: 9 }]),
          'post:t3_broken': '{not json',
          'post:t3_no_count': JSON.stringify({ slot: 'Morning' }),
          'post:t3_fraction': JSON.stringify({ slot: 'Evening', solvers: 1.5 }),
          app_open: '12',
        },
      },
    ]

    expect(summarizeSlots(records)).toEqual([
      { slot: 'Morning', posts: 0, median: null },
      { slot: 'Evening', posts: 0, median: null },
    ])
  })
})

describe('averageOpeners', () => {
  it('averages unique shop and app openers over the newest 30 recorded days', () => {
    const days = listDates('2026-09-21', '2026-10-21').map((date) =>
      // 2026-09-21 is the 31st newest recorded day, so its large counts must not count
      date === '2026-09-21' ? recordedDay(date, 500, 500) : recordedDay(date, 1, 40)
    )
    // A day that holds only a post section has no funnel counts to average.
    const postOnly = { date: '2026-10-22', fields: postSection([]) }

    expect(averageOpeners([...days, postOnly])).toEqual({ days: 30, shop: 1, app: 40 })
  })

  it('rounds to one decimal and reports how many days it averaged', () => {
    const days = [
      recordedDay('2026-10-19', 1, 10),
      recordedDay('2026-10-20', 0, 11),
      recordedDay('2026-10-21', 1, 13),
    ]

    expect(averageOpeners(days)).toEqual({ days: 3, shop: 0.7, app: 11.3 })
  })

  it('returns null without a recorded day', () => {
    expect(averageOpeners([])).toBeNull()
    expect(averageOpeners([{ date: '2026-10-01', fields: postSection([]) }])).toBeNull()
  })
})

describe('formatSlotShopReadout', () => {
  const thirtyDays = listDates('2026-09-22', '2026-10-21').map((date) =>
    recordedDay(date, date < '2026-10-07' ? 1 : 2, 42)
  )

  it('shows each slot’s median solvers per post with its post count, then the openers', () => {
    const text = formatSlotShopReadout({
      postsThrough: POSTS_THROUGH,
      daily: [
        ...dailyPosts('Morning', SLOT_WINDOW_START, FOURTEEN_COUNTS),
        ...dailyPosts('Evening', '2026-09-30', [...FOURTEEN_COUNTS, 30].map((count) => count * 2)),
        ...thirtyDays,
      ],
    })

    // Morning 1..14 → 7.5; Evening 2..28 and 60 → 16. Shop: 15 days at 1 and 15 at 2.
    expect(text).toBe(
      'Median solvers/post to 2026-10-14: Morning 7.5 (14 posts), Evening 16 (15 posts) · Openers/day: shop 1.5, app 42 (30 days)'
    )
  })

  it('names the last recorded post day, so an older window reads as older', () => {
    // The backfill records the oldest posts first, so after its first night the
    // cursor can sit months back.
    const text = formatSlotShopReadout({
      postsThrough: '2026-06-30',
      daily: [...dailyPosts('Morning', '2026-06-01', FOURTEEN_COUNTS), ...thirtyDays],
    })

    expect(text).toBe(
      'Median solvers/post to 2026-06-30: Morning 7.5 (14 posts), Evening too few posts (0) · Openers/day: shop 1.5, app 42 (30 days)'
    )
  })

  it('counts only posts from the 8 weeks that end on the post cursor', () => {
    const text = formatSlotShopReadout({
      postsThrough: POSTS_THROUGH,
      daily: [
        ...dailyPosts('Morning', SLOT_WINDOW_START, FOURTEEN_COUNTS),
        ...dailyPosts('Morning', addDays(SLOT_WINDOW_START, -1), [900]),
        ...dailyPosts('Evening', addDays(POSTS_THROUGH, -13), FOURTEEN_COUNTS),
        ...dailyPosts('Evening', addDays(POSTS_THROUGH, 1), [900]),
      ],
    })

    expect(text).toBe(
      'Median solvers/post to 2026-10-14: Morning 7.5 (14 posts), Evening 7.5 (14 posts) · Openers/day: no daily records yet'
    )
  })

  it('says a slot has too few posts instead of showing a median', () => {
    const text = formatSlotShopReadout({
      postsThrough: POSTS_THROUGH,
      daily: [
        ...dailyPosts('Morning', SLOT_WINDOW_START, FOURTEEN_COUNTS.slice(0, 13)),
        ...dailyPosts('Evening', '2026-10-01', FOURTEEN_COUNTS),
        recordedDay('2026-10-21', 2, 9),
      ],
    })

    expect(text).toBe(
      'Median solvers/post to 2026-10-14: Morning too few posts (13), Evening 7.5 (14 posts) · Openers/day: shop 2, app 9 (1 day)'
    )
  })

  it('says when no post has been recorded yet', () => {
    expect(formatSlotShopReadout({ postsThrough: undefined, daily: thirtyDays })).toBe(
      'Median solvers/post: no recorded posts yet · Openers/day: shop 1.5, app 42 (30 days)'
    )
  })

  it('explains when the nightly job has not written a record yet', () => {
    expect(formatSlotShopReadout({ postsThrough: undefined, daily: [] })).toBe(
      'No baseline records yet. The nightly job runs at 00:30 UTC.'
    )
  })
})
