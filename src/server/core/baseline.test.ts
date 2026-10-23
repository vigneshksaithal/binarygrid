import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)

import { reddit, redis } from '@devvit/web/server'
import { buildPostSection, listDates, type PostSlot } from '../../shared/baseline'
import { type createDevvitServerFake, fakeListing } from '../test-helpers/devvit-fake'
import {
  readBaselineReadout,
  readSlotShopReadout,
  recordHourlySolve,
  runBaselineJob,
} from './baseline'
import { stampPost } from './puzzle-number'

type Fake = ReturnType<typeof createDevvitServerFake>

const fakeRedis = redis as unknown as Fake['redis']
const fakeReddit = reddit as unknown as Fake['reddit']

// Runs at 00:30 UTC on 2026-10-22: the window is the 59 complete days 2026-08-24..2026-10-21.
const NOW = new Date('2026-10-22T00:30:00.000Z')
const WINDOW_DATES = listDates('2026-08-24', '2026-10-21')
// The first night whose window includes 2026-11-11, day 30 of the 2026-10-12 cohort.
const DAY_30_NIGHT = new Date('2026-11-12T00:30:00.000Z')

const APP_OPENS: Record<string, string[]> = {
  '2026-09-01': ['t2_ivy'],
  '2026-10-01': ['t2_ivy'],
  '2026-10-12': ['t2_fay', 't2_gus'],
  '2026-10-14': ['t2_cy'],
  '2026-10-15': ['t2_ana', 't2_dee', 't2_gus'],
  '2026-10-16': ['t2_ben', 't2_cy', 't2_dee'],
  '2026-10-17': ['t2_ana', 't2_dee'],
  '2026-10-18': ['t2_cy', 't2_dee', 't2_vet', 't2_hal'],
  '2026-10-19': ['t2_dee', 't2_fay', 't2_hal'],
  '2026-10-20': ['t2_ben', 't2_dee'],
  '2026-10-21': ['t2_ana', 't2_dee', 't2_eve'],
}

const SOLVES: Record<string, string[]> = {
  '2026-10-14': ['t2_cy'],
  '2026-10-15': ['t2_ana', 't2_dee'],
  '2026-10-16': ['t2_ben', 't2_cy', 't2_dee'],
  '2026-10-17': ['t2_ana', 't2_dee'],
  '2026-10-18': ['t2_cy', 't2_dee'],
  '2026-10-19': ['t2_dee'],
  '2026-10-20': ['t2_ben', 't2_dee'],
  '2026-10-21': ['t2_ana', 't2_dee', 't2_eve'],
}

// t2_fay taps on 10-13 without an app_open that day, which inverts the funnel.
const FIRST_INPUTS: Record<string, string[]> = { ...SOLVES, '2026-10-13': ['t2_fay'] }

const addUniqueEvents = async (event: string, byDate: Record<string, string[]>) => {
  for (const [date, users] of Object.entries(byDate)) {
    await redis.hSet(
      `daily:${date}:unique:${event}`,
      Object.fromEntries(users.map((user) => [user, '1']))
    )
  }
}

const addBoard = async (key: string, entries: [string, number][]) => {
  for (const [member, score] of entries) {
    await redis.zAdd(key, { member, score })
  }
}

const post = (id: string, title: string, createdAt: string) => ({
  id,
  title,
  createdAt: new Date(createdAt),
})

const POSTS = [
  post('t3_fresh', 'Binary Grid: 2026-10-20 (Morning)', '2026-10-20T08:00:01.000Z'),
  post('t3_recap', 'Binary Grid weekly recap: 2026-W40', '2026-10-04T18:00:00.000Z'),
  post('t3_e1', 'Binary Grid: 2026-10-01 (Evening)', '2026-10-01T20:00:03.000Z'),
  post('t3_m1', 'Binary Grid: 2026-10-01 (Morning)', '2026-10-01T08:00:04.000Z'),
  post('t3_old', 'Binary Grid: 2026-02-01', '2026-02-01T00:00:10.000Z'),
]

const seedFixture = async () => {
  await addUniqueEvents('app_open', APP_OPENS)
  await addUniqueEvents('first_input', FIRST_INPUTS)
  await addUniqueEvents('submit_success', SOLVES)
  await redis.hSet('daily:2026-10-21:hourly:submit_success', { '08': '2', '20': '1' })
  await addBoard('leaderboard:weekly:2026-W30:medium', [['t2_vet', 120]])
  await addBoard('leaderboard:weekly:2026-W42:medium', [
    ['t2_ana', 90],
    ['t2_ben', 95],
    ['t2_cy', 80],
    ['t2_dee', 70],
  ])
  await addBoard('leaderboard:weekly:2026-W43:easy', [
    ['t2_ana', 60],
    ['t2_ben', 61],
    ['t2_dee', 62],
    ['t2_eve', 63],
  ])
  await addBoard('leaderboard:t3_m1:easy', [
    ['t2_ivy', 50],
    ['t2_p1', 70],
  ])
  await addBoard('leaderboard:t3_m1:medium', [
    ['t2_p1', 5],
    ['t2_p2', 100],
  ])
  await addBoard('leaderboard:t3_e1:hard', [['t2_p3', 300]])
  await addBoard('leaderboard:t3_old:medium', [['t2_p4', 8]])
  await addBoard('leaderboard:t3_fresh:easy', [['t2_p5', 40]])
  fakeReddit.getNewPosts.mockImplementation(() => fakeListing(POSTS))
}

const record = (key: string): Record<string, string> => fakeRedis.__hashStore.get(key) ?? {}

const writtenStrings = (): string[] => [
  ...fakeRedis.hSet.mock.calls.flatMap(([key, fields]) => [
    key,
    ...Object.entries(fields).flat(),
  ]),
  ...fakeRedis.set.mock.calls.flat(),
  ...fakeRedis.hIncrBy.mock.calls.flatMap(([key, field]) => [key, field]),
  ...fakeRedis.zAdd.mock.calls.map(([key]) => key),
]

beforeEach(async () => {
  vi.clearAllMocks()
  fakeRedis.__clearStore()
  fakeReddit.getNewPosts.mockImplementation(() => fakeListing([]))
  await seedFixture()
  vi.clearAllMocks()
})

describe('runBaselineJob daily records', () => {
  it('writes a record for every complete date still in the window on the first run', async () => {
    const summary = await runBaselineJob(NOW)

    expect(summary.dailyRecords).toBe(WINDOW_DATES.length)
    expect(WINDOW_DATES).toHaveLength(59)
    expect(record('metrics:daily:2026-08-24').recorded_at).toBe(NOW.toISOString())
    expect(record('metrics:daily:2026-10-21').recorded_at).toBe(NOW.toISOString())
    // 60 days back expires during the night, so it is left out rather than half-read
    expect(record('metrics:daily:2026-08-23')).toEqual({})
    expect(record('metrics:daily:2026-10-22')).toEqual({})
  })

  it('writes nothing new on a second run', async () => {
    await runBaselineJob(NOW)
    vi.clearAllMocks()

    const summary = await runBaselineJob(NOW)

    expect(summary).toEqual({ dailyRecords: 0, cohortRecords: 0, weekRecords: 0, postDates: 0 })
    expect(fakeRedis.hSet).not.toHaveBeenCalled()
    expect(fakeRedis.set).not.toHaveBeenCalled()
  })

  it('matches hand counts for the funnel, WRS, DQE and solves per hour', async () => {
    await runBaselineJob(NOW)
    const day = record('metrics:daily:2026-10-21')
    const hours = Array.from({ length: 24 }, (_, hour) => ({ 8: 2, 20: 1 })[hour] ?? 0)

    expect(day).toMatchObject({
      app_open: '3',
      first_input: '3',
      submit_success: '3',
      share_success: '0',
      join_success: '0',
      shop_open: '0',
      active_users: '3',
      new_users: '1',
      // ana solved 3 of 10-15..10-21 and dee 7; ben and cy solved 2, eve 1
      wrs: '2',
      // unique openers 10-15..10-21: 3 + 3 + 2 + 4 + 3 + 2 + 3 = 20, over 7 days
      dqe: '2.9',
      solves_by_hour: JSON.stringify(hours),
      quality: 'ok',
    })
  })

  it('flags an inverted funnel day instead of writing it silently', async () => {
    await runBaselineJob(NOW)

    expect(record('metrics:daily:2026-10-13')).toMatchObject({
      app_open: '0',
      first_input: '1',
      quality: 'app_open_below_first_input',
    })
  })

  it('omits WRS and DQE while the seven-day lookback reaches before the window', async () => {
    await runBaselineJob(NOW)

    expect(record('metrics:daily:2026-08-29').wrs).toBeUndefined()
    expect(record('metrics:daily:2026-08-29').quality).toContain('lookback_incomplete')
    expect(record('metrics:daily:2026-08-30').wrs).toBe('0')
  })
})

describe('runBaselineJob cohorts', () => {
  it('matches hand counts for cohort size and day-1, day-3, day-7 and day-30 returns', async () => {
    await runBaselineJob(NOW)

    // fay returns on 10-13 and 10-19, gus on 10-15
    expect(record('metrics:cohort:2026-10-12')).toEqual({
      size: '2',
      history_days: '49',
      d1: '1',
      d3: '1',
      d7: '1',
    })
    // ana and dee; only dee returns on 10-16 and 10-18
    expect(record('metrics:cohort:2026-10-15')).toEqual({
      size: '2',
      history_days: '52',
      d1: '1',
      d3: '1',
    })
    // t2_vet was on a weekly board before the window, so only hal is new on 10-18
    expect(record('metrics:cohort:2026-10-18')).toMatchObject({ size: '1', d1: '1', d3: '0' })
    expect(record('metrics:cohort:2026-09-01')).toMatchObject({ size: '1', d30: '1' })
    expect(record('metrics:cohort:2026-10-21')).toEqual({ size: '1', history_days: '58' })
  })

  it('puts each user in exactly one cohort', async () => {
    await runBaselineJob(NOW)
    const total = WINDOW_DATES.map((date) => Number(record(`metrics:cohort:${date}`).size ?? 0))
      .reduce((sum, size) => sum + size, 0)

    // ivy, fay, gus, cy, ana, dee, ben, hal, eve; t2_vet is a known solver
    expect(total).toBe(9)
  })

  it('fills retention fields on later nights without rewriting earlier ones', async () => {
    await runBaselineJob(NOW)
    await redis.hSet('daily:2026-10-22:unique:app_open', { t2_ana: '1', t2_eve: '1' })
    vi.clearAllMocks()

    await runBaselineJob(new Date('2026-10-23T00:30:00.000Z'))

    expect(record('metrics:cohort:2026-10-21')).toEqual({
      size: '1',
      history_days: '58',
      d1: '1',
    })
    expect(record('metrics:cohort:2026-10-15')).toMatchObject({ d7: '1' })
    const cohortWrites = fakeRedis.hSet.mock.calls.filter(([key]) =>
      key.startsWith('metrics:cohort:2026-10-21')
    )
    expect(cohortWrites).toEqual([['metrics:cohort:2026-10-21', { d1: '1' }]])
  })

  it('writes day 30 on a later night while the re-derived cohort is unchanged', async () => {
    await runBaselineJob(NOW)
    await redis.hSet('daily:2026-11-11:unique:app_open', { t2_fay: '1' })

    await runBaselineJob(DAY_30_NIGHT)

    expect(record('metrics:cohort:2026-10-12')).toEqual({
      size: '2',
      history_days: '49',
      d1: '1',
      d3: '1',
      d7: '1',
      d30: '1',
    })
  })

  it('flags day 30 instead of counting it when a returning player joins the re-derived cohort', async () => {
    await runBaselineJob(NOW)
    await redis.hSet('daily:2026-10-31:unique:app_open', { t2_ivy: '1' })

    await runBaselineJob(DAY_30_NIGHT)

    // ivy's 09-01 visit kept them out of the 10-01 cohort. Once 09-01 leaves the
    // window they look new on 10-01, and counting them would report 1 return of 0.
    expect(record('metrics:cohort:2026-10-01')).toEqual({
      size: '0',
      history_days: '38',
      d1: '0',
      d3: '0',
      d7: '0',
      d30_skipped: 'cohort_changed',
    })
  })

  it('writes weekly cohorts from the daily cohorts and the weekly boards', async () => {
    await runBaselineJob(NOW)

    // Daily cohorts 10-12..10-18: sizes 2+0+1+2+1+0+1, day-1 returns 1+0+0+1+0+0+1,
    // day-3 returns 1+0+0+1+0+0+0. Day-7 needs 10-25, so it waits.
    expect(record('metrics:cohort-week:2026-W42')).toEqual({
      size: '7',
      history_days: '49',
      d1: '3',
      d3: '2',
      solvers: '4',
      // boards start in 2026-W20, so 2026-W42 is compared against 22 earlier weeks
      solver_history_weeks: '22',
      new_solvers: '4',
    })
    expect(record('metrics:cohort-week:2026-W30')).toEqual({
      solvers: '1',
      solver_history_weeks: '10',
      new_solvers: '1',
      new_solvers_week2: '0',
      new_solvers_week5: '0',
    })
    expect(record('metrics:cohort-week:2026-W43')).toEqual({})
  })
})

describe('runBaselineJob privacy', () => {
  it('writes no user IDs and gives no metrics key a TTL', async () => {
    await runBaselineJob(NOW)
    await readBaselineReadout(NOW)

    expect(writtenStrings().length).toBeGreaterThan(0)
    expect(writtenStrings().filter((value) => value.includes('t2_'))).toEqual([])
    const expiredKeys = fakeRedis.expire.mock.calls.map(([key]) => key)
    expect(expiredKeys.filter((key) => key.startsWith('metrics:'))).toEqual([])
  })
})

describe('runBaselineJob posts', () => {
  it('records unique solvers per post and tier with the slot, once posts are a week old', async () => {
    await runBaselineJob(NOW)
    const day = record('metrics:daily:2026-10-01')

    expect(day.posts_recorded).toBe('2')
    expect(day.subfloor_top10).toBe('1')
    expect(JSON.parse(day['post:t3_m1'] ?? '{}')).toEqual({
      slot: 'Morning',
      hour: 8,
      solvers: 3,
      easy: 2,
      medium: 2,
      hard: 0,
      subfloor: 1,
    })
    expect(JSON.parse(day['post:t3_e1'] ?? '{}')).toEqual({
      slot: 'Evening',
      hour: 20,
      solvers: 1,
      easy: 0,
      medium: 0,
      hard: 1,
      subfloor: 0,
    })
    expect(record('metrics:daily:2026-10-20').posts_recorded).toBeUndefined()
    expect(record('metrics:baseline:state')).toEqual({ posts_through: '2026-10-14' })
  })

  it('backfills older posts and marks window days that had no post', async () => {
    await runBaselineJob(NOW)
    const old = record('metrics:daily:2026-02-01')

    expect(old.posts_recorded).toBe('1')
    expect(JSON.parse(old['post:t3_old'] ?? '{}')).toMatchObject({ slot: 'single', subfloor: 1 })
    expect(old.recorded_at).toBeUndefined()
    expect(record('metrics:daily:2026-10-14').posts_recorded).toBe('0')
    expect(record('metrics:daily:2026-10-04').posts_recorded).toBe('0')
  })

  it('records stamped "Binary Grid #N" posts with the slot from their creation hour', async () => {
    await stampPost('t3_n1', 1, new Date('2026-10-02T08:00:01.000Z'))
    await stampPost('t3_n2', 2, new Date('2026-10-03T20:00:01.000Z'))
    await addBoard('leaderboard:t3_n1:easy', [['t2_p6', 45]])
    await addBoard('leaderboard:t3_n2:hard', [
      ['t2_p6', 200],
      ['t2_p7', 210],
    ])
    fakeReddit.getNewPosts.mockImplementation(() =>
      fakeListing([
        post('t3_fresh', 'Binary Grid: 2026-10-20 (Morning)', '2026-10-20T08:00:01.000Z'),
        // Not stamped by createPost, so not a daily post despite the title.
        post('t3_lookalike', 'Binary Grid #3', '2026-10-05T08:00:02.000Z'),
        post('t3_recap', 'Binary Grid weekly recap: 2026-W40', '2026-10-04T18:00:00.000Z'),
        post('t3_n2', 'Binary Grid #2', '2026-10-03T20:00:02.000Z'),
        post('t3_n1', 'Binary Grid #1', '2026-10-02T08:00:02.000Z'),
        post('t3_e1', 'Binary Grid: 2026-10-01 (Evening)', '2026-10-01T20:00:03.000Z'),
        post('t3_m1', 'Binary Grid: 2026-10-01 (Morning)', '2026-10-01T08:00:04.000Z'),
      ])
    )

    await runBaselineJob(NOW)

    expect(JSON.parse(record('metrics:daily:2026-10-02')['post:t3_n1'] ?? '{}')).toEqual({
      slot: 'Morning',
      hour: 8,
      solvers: 1,
      easy: 1,
      medium: 0,
      hard: 0,
      subfloor: 0,
    })
    expect(JSON.parse(record('metrics:daily:2026-10-03')['post:t3_n2'] ?? '{}')).toMatchObject({
      slot: 'Evening',
      hour: 20,
      solvers: 2,
      hard: 2,
    })
    expect(record('metrics:daily:2026-10-05').posts_recorded).toBe('0')
    expect(record('metrics:daily:2026-10-04').posts_recorded).toBe('0')
    expect(record('metrics:daily:2026-10-01').posts_recorded).toBe('2')
  })

  it('records a post on the first night after it turns a week old', async () => {
    await runBaselineJob(NOW)
    vi.clearAllMocks()

    await runBaselineJob(new Date('2026-10-28T00:30:00.000Z'))

    expect(JSON.parse(record('metrics:daily:2026-10-20')['post:t3_fresh'] ?? '{}')).toMatchObject({
      slot: 'Morning',
      solvers: 1,
    })
    expect(record('metrics:baseline:state')).toEqual({ posts_through: '2026-10-20' })
    expect(fakeRedis.hSet).not.toHaveBeenCalledWith('metrics:daily:2026-10-01', expect.anything())
  })

  it('resumes the post backfill on the next run when the per-run budget runs out', async () => {
    await runBaselineJob(NOW, { maxPostsPerRun: 1 })

    expect(record('metrics:daily:2026-02-01').posts_recorded).toBe('1')
    expect(record('metrics:daily:2026-10-01').posts_recorded).toBeUndefined()
    expect(record('metrics:baseline:state')).toEqual({ posts_through: '2026-09-30' })

    await runBaselineJob(NOW, { maxPostsPerRun: 1 })

    expect(record('metrics:daily:2026-10-01').posts_recorded).toBe('2')
    expect(record('metrics:baseline:state')).toEqual({ posts_through: '2026-10-14' })
  })
})

describe('recordHourlySolve', () => {
  it('counts a solve under its UTC date and hour with the 60-day analytics TTL', async () => {
    await recordHourlySolve(new Date('2026-10-25T08:59:00.000Z'))
    await recordHourlySolve(new Date('2026-10-25T08:01:00.000Z'))
    await recordHourlySolve(new Date('2026-10-25T23:30:00.000Z'))

    expect(record('daily:2026-10-25:hourly:submit_success')).toEqual({ '08': '2', '23': '1' })
    expect(fakeRedis.expire).toHaveBeenCalledWith(
      'daily:2026-10-25:hourly:submit_success',
      60 * 60 * 24 * 60
    )
  })
})

describe('readBaselineReadout', () => {
  it('reads the latest WRS, the week’s new users and pooled day-1 retention', async () => {
    await runBaselineJob(NOW)

    // Cohorts 10-14..10-20: sizes 1+2+1+0+1+0+0, day-1 returns 0+1+0+0+1+0+0
    expect(await readBaselineReadout(NOW)).toBe(
      'WRS 2 (2026-10-21) · New users 2026-W43: 1 · Day-1 retention 40% (2 of 5, 2026-10-14 to 2026-10-20)'
    )
  })

  it('explains when the job has not written a record yet', async () => {
    expect(await readBaselineReadout(NOW)).toBe(
      'No baseline records yet. The nightly job runs at 00:30 UTC.'
    )
  })
})

// Stores one recorded post per day from `dates`, as the nightly job's post section does.
const recordDailyPosts = async (slot: PostSlot, dates: readonly string[], solvers: number) => {
  for (const date of dates) {
    const section = buildPostSection([
      {
        id: `t3_${slot}_${date}`,
        slot,
        hour: slot === 'Evening' ? 20 : 8,
        tierSolvers: { easy: solvers, medium: 0, hard: 0 },
        uniqueSolvers: solvers,
        subFloor: 0,
      },
    ])
    await redis.hSet(`metrics:daily:${date}`, section)
  }
}

describe('readSlotShopReadout', () => {
  it('reads slot medians and openers from the records the nightly job wrote, and writes nothing', async () => {
    await runBaselineJob(NOW)
    vi.clearAllMocks()

    // The post cursor is 2026-10-14; its 8 weeks hold t3_m1 (Morning) and t3_e1 (Evening).
    // App openers on the newest 30 recorded days (2026-09-22..2026-10-21): 24, so 0.8 a day.
    expect(await readSlotShopReadout(NOW)).toBe(
      'Median solvers/post to 2026-10-14: Morning too few posts (1), Evening too few posts (1) · Openers/day: shop 0, app 0.8 (30 days)'
    )
    expect(fakeRedis.hSet).not.toHaveBeenCalled()
    expect(fakeRedis.expire).not.toHaveBeenCalled()
  })

  it('reads all 8 weeks that end on the post cursor, including days before the job window', async () => {
    await redis.hSet('metrics:baseline:state', { posts_through: '2026-10-14' })
    // 2026-08-20 to 08-23 come before the job's 59-day window (2026-08-24 onward).
    await recordDailyPosts('Morning', listDates('2026-08-20', '2026-09-02'), 6)
    await recordDailyPosts('Morning', ['2026-08-19'], 900)
    await recordDailyPosts('Evening', listDates('2026-10-01', '2026-10-14'), 4)
    await recordDailyPosts('Evening', ['2026-10-15'], 900)

    expect(await readSlotShopReadout(NOW)).toBe(
      'Median solvers/post to 2026-10-14: Morning 6 (14 posts), Evening 4 (14 posts) · Openers/day: no daily records yet'
    )
  })

  it('explains when the job has not written a record yet', async () => {
    expect(await readSlotShopReadout(NOW)).toBe(
      'No baseline records yet. The nightly job runs at 00:30 UTC.'
    )
  })
})
