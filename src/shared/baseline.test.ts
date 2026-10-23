import { describe, expect, it } from 'vitest'
import {
  addDays,
  assignCohorts,
  averageDailyOpeners,
  buildDailyRecord,
  buildPostSection,
  countReturned,
  countRitualSolvers,
  daysBetween,
  detectFunnelIssues,
  findPreWindowSolvers,
  formatBaselineReadout,
  isLookbackComplete,
  listDates,
  newSolversByWeek,
  parsePostSlot,
  parseSolvesByHour,
  pendingCohortFields,
  pendingSolverWeekFields,
  slotOfHour,
  solveHourField,
  subFloorSeconds,
  sumCohortWeek,
  summarizePostBoards,
  weekIdOf,
  weekStartOf,
} from './baseline'

const usersByDate = (entries: Record<string, string[]>): Map<string, Set<string>> =>
  new Map(Object.entries(entries).map(([date, users]) => [date, new Set(users)]))

const orderedCounts = {
  app_open: 10,
  first_input: 8,
  submit_success: 5,
  share_success: 2,
  join_success: 1,
  shop_open: 0,
}

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2026-10-22', -60)).toBe('2026-08-23')
  })

  it('lists every date between two dates inclusively', () => {
    expect(listDates('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
    expect(listDates('2026-10-02', '2026-10-01')).toEqual([])
  })

  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-08-23', '2026-10-21')).toBe(59)
  })

  it('finds the ISO week and its Monday for a date', () => {
    expect(weekIdOf('2026-10-18')).toBe('2026-W42')
    expect(weekIdOf('2026-10-19')).toBe('2026-W43')
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12')
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19')
  })
})

describe('countRitualSolvers', () => {
  const solvers = usersByDate({
    '2026-10-14': ['t2_cy'],
    '2026-10-15': ['t2_ana', 't2_dee'],
    '2026-10-16': ['t2_ben', 't2_cy', 't2_dee'],
    '2026-10-17': ['t2_ana', 't2_dee'],
    '2026-10-18': ['t2_cy', 't2_dee'],
    '2026-10-19': ['t2_dee'],
    '2026-10-20': ['t2_ben', 't2_dee'],
    '2026-10-21': ['t2_ana', 't2_dee', 't2_eve'],
  })

  it('counts players who solved on at least 3 of the last 7 days', () => {
    // ana 3 days, dee 7 days; ben 2, cy 2 inside the window (10-14 is outside), eve 1
    expect(countRitualSolvers(solvers, '2026-10-21')).toBe(2)
  })

  it('moves the seven-day window with the end date', () => {
    // 10-14..10-20: cy 3, dee 6, ana 2, ben 2
    expect(countRitualSolvers(solvers, '2026-10-20')).toBe(2)
    // 10-16..10-22: ana 2, ben 2, cy 2, dee 6, eve 1
    expect(countRitualSolvers(solvers, '2026-10-22')).toBe(1)
  })

  it('returns zero when nobody solved', () => {
    expect(countRitualSolvers(new Map(), '2026-10-21')).toBe(0)
  })
})

describe('averageDailyOpeners', () => {
  it('averages daily unique openers over the last 7 days to one decimal', () => {
    const openers = usersByDate({
      '2026-10-14': ['t2_out', 't2_side'],
      '2026-10-15': ['t2_a'],
      '2026-10-16': ['t2_a', 't2_b'],
      '2026-10-17': ['t2_a', 't2_b', 't2_c'],
      '2026-10-21': ['t2_a'],
    })

    expect(averageDailyOpeners(openers, '2026-10-21')).toBe(1)
    expect(averageDailyOpeners(openers, '2026-10-20')).toBe(1.1)
  })
})

describe('isLookbackComplete', () => {
  it('requires all seven lookback days inside the data window', () => {
    expect(isLookbackComplete('2026-08-29', '2026-08-23')).toBe(true)
    expect(isLookbackComplete('2026-08-28', '2026-08-23')).toBe(false)
  })
})

const weekOf = (weekId: string, weekStart: string, weekEnd: string, solvers: string[]) => ({
  weekId,
  weekStart,
  weekEnd,
  solvers: new Set(solvers),
})

describe('findPreWindowSolvers', () => {
  const solversByDate = usersByDate({
    '2026-08-24': ['t2_mixed'],
    '2026-08-25': ['t2_late'],
  })
  const weeks = [
    weekOf('2026-W30', '2026-07-20', '2026-07-26', ['t2_veteran']),
    // Straddles the window start (Sunday 2026-08-23): only 08-23 is inside the window.
    weekOf('2026-W34', '2026-08-17', '2026-08-23', ['t2_early', 't2_mixed']),
    // Starts inside the window, where the daily hashes are authoritative.
    weekOf('2026-W35', '2026-08-24', '2026-08-30', ['t2_late', 't2_unrecorded']),
  ]

  it('marks solvers from weeks before the window as already known', () => {
    const known = findPreWindowSolvers({ windowStart: '2026-08-23', weeks, solversByDate })

    expect(known.has('t2_veteran')).toBe(true)
    expect(known.has('t2_early')).toBe(true)
    // t2_mixed has no solve on 08-23, so its straddling-week solve came before the window
    expect(known.has('t2_mixed')).toBe(true)
  })

  it('ignores weeks that start inside the window', () => {
    const known = findPreWindowSolvers({ windowStart: '2026-08-23', weeks, solversByDate })

    expect(known.has('t2_late')).toBe(false)
    expect(known.has('t2_unrecorded')).toBe(false)
  })

  it('treats a straddling-week solver with an in-window solve that week as new', () => {
    const known = findPreWindowSolvers({
      windowStart: '2026-08-23',
      weeks,
      solversByDate: usersByDate({ '2026-08-23': ['t2_early'] }),
    })

    expect(known.has('t2_early')).toBe(false)
  })
})

describe('assignCohorts', () => {
  const active = usersByDate({
    '2026-10-12': ['t2_ana', 't2_veteran'],
    '2026-10-13': ['t2_ana', 't2_ben'],
    '2026-10-14': ['t2_ben', 't2_cy', 't2_dee'],
  })

  it('places each user in the cohort of the first date they were seen', () => {
    const cohorts = assignCohorts(active, new Set(['t2_veteran']))

    expect([...(cohorts.get('2026-10-12') ?? [])]).toEqual(['t2_ana'])
    expect([...(cohorts.get('2026-10-13') ?? [])]).toEqual(['t2_ben'])
    expect([...(cohorts.get('2026-10-14') ?? [])].sort()).toEqual(['t2_cy', 't2_dee'])
  })

  it('puts every user in exactly one cohort and skips known users', () => {
    const cohorts = assignCohorts(active, new Set(['t2_veteran']))
    const members = [...cohorts.values()].flatMap((cohort) => [...cohort])

    expect(members.sort()).toEqual(['t2_ana', 't2_ben', 't2_cy', 't2_dee'])
  })

  it('processes dates in calendar order regardless of map order', () => {
    const cohorts = assignCohorts(
      usersByDate({ '2026-10-14': ['t2_ana'], '2026-10-12': ['t2_ana'] }),
      new Set()
    )

    expect(cohorts.get('2026-10-12')?.size).toBe(1)
    expect(cohorts.get('2026-10-14')?.size).toBe(0)
  })
})

describe('countReturned', () => {
  it('counts cohort members active on the later day', () => {
    const cohort = new Set(['t2_a', 't2_b', 't2_c'])

    expect(countReturned(cohort, new Set(['t2_a', 't2_c', 't2_z']))).toBe(2)
    expect(countReturned(cohort, undefined)).toBe(0)
  })
})

describe('pendingCohortFields', () => {
  const activeByDate = usersByDate({
    '2026-10-19': ['t2_a'],
    '2026-10-21': ['t2_a', 't2_b'],
  })

  it('writes size, history and every retention day that has completed', () => {
    const fields = pendingCohortFields({
      date: '2026-10-18',
      existing: {},
      members: new Set(['t2_a', 't2_b', 't2_c']),
      activeByDate,
      lastCompleteDate: '2026-10-21',
      historyDays: 56,
    })

    expect(fields).toEqual({ size: '3', history_days: '56', d1: '1', d3: '2' })
  })

  it('never rewrites a field that already exists', () => {
    const fields = pendingCohortFields({
      date: '2026-10-18',
      existing: { size: '3', history_days: '56', d1: '1' },
      members: new Set(['t2_a', 't2_b', 't2_c', 't2_d']),
      activeByDate,
      lastCompleteDate: '2026-10-21',
      historyDays: 59,
    })

    expect(fields).toEqual({ d3: '2' })
  })

  it('writes day 30 on a later night while the cohort still has size members', () => {
    const fields = pendingCohortFields({
      date: '2026-09-01',
      existing: { size: '2', history_days: '20', d1: '1', d3: '0', d7: '0' },
      members: new Set(['t2_a', 't2_b']),
      activeByDate: usersByDate({ '2026-10-01': ['t2_a', 't2_z'] }),
      lastCompleteDate: '2026-10-01',
      historyDays: 0,
    })

    expect(fields).toEqual({ d30: '1' })
  })

  it('flags day 30 once instead of counting it when the re-derived cohort has grown', () => {
    const input = {
      date: '2026-09-01',
      members: new Set(['t2_a', 't2_b', 't2_returning']),
      activeByDate: usersByDate({ '2026-09-02': ['t2_a'], '2026-10-01': ['t2_returning'] }),
      lastCompleteDate: '2026-10-01',
      historyDays: 0,
    }

    const counted = { size: '2', history_days: '20', d3: '0', d7: '0' }
    const flagged = { ...counted, d1: '1', d30_skipped: 'cohort_changed' }

    // days 1 to 7 are still counted; day 30 is flagged once and then left alone
    expect(pendingCohortFields({ ...input, existing: counted })).toEqual({
      d1: '1',
      d30_skipped: 'cohort_changed',
    })
    expect(pendingCohortFields({ ...input, existing: flagged })).toEqual({})
  })

  it('writes nothing when every computable field exists', () => {
    const fields = pendingCohortFields({
      date: '2026-10-18',
      existing: { size: '3', history_days: '56', d1: '1', d3: '2' },
      members: new Set(['t2_a']),
      activeByDate,
      lastCompleteDate: '2026-10-21',
      historyDays: 56,
    })

    expect(fields).toEqual({})
  })
})

describe('sumCohortWeek', () => {
  const day = (fields: Record<string, string>) => fields

  it('sums a field only once all seven daily cohorts have it', () => {
    const daily = [
      day({ size: '2', history_days: '50', d1: '1', d3: '1' }),
      day({ size: '1', history_days: '51', d1: '0', d3: '0' }),
      day({ size: '0', history_days: '52', d1: '0', d3: '0' }),
      day({ size: '3', history_days: '53', d1: '2', d3: '1' }),
      day({ size: '1', history_days: '54', d1: '1', d3: '1' }),
      day({ size: '2', history_days: '55', d1: '1' }),
      day({ size: '1', history_days: '56', d1: '0' }),
    ]

    expect(sumCohortWeek({}, daily)).toEqual({ size: '10', history_days: '50', d1: '5' })
  })

  it('skips weeks with a missing daily cohort and keeps existing fields', () => {
    const full = Array.from({ length: 7 }, () => day({ size: '1', history_days: '9', d1: '1' }))

    expect(sumCohortWeek({}, [undefined, ...full.slice(1)])).toEqual({})
    expect(sumCohortWeek({ size: '7', history_days: '9' }, full)).toEqual({ d1: '7' })
  })
})

describe('weekly solver cohorts', () => {
  const weeks = [
    weekOf('2026-W40', '2026-09-28', '2026-10-04', ['t2_a', 't2_b']),
    weekOf('2026-W41', '2026-10-05', '2026-10-11', ['t2_a', 't2_c']),
    weekOf('2026-W42', '2026-10-12', '2026-10-18', ['t2_c', 't2_d']),
    weekOf('2026-W43', '2026-10-19', '2026-10-25', ['t2_b']),
    weekOf('2026-W44', '2026-10-26', '2026-11-01', ['t2_b', 't2_e']),
  ]

  it('finds the solvers whose first weekly board is each week', () => {
    const fresh = newSolversByWeek(weeks)

    expect([...(fresh.get('2026-W40') ?? [])]).toEqual(['t2_a', 't2_b'])
    expect([...(fresh.get('2026-W41') ?? [])]).toEqual(['t2_c'])
    expect([...(fresh.get('2026-W42') ?? [])]).toEqual(['t2_d'])
    expect([...(fresh.get('2026-W43') ?? [])]).toEqual([])
  })

  it('writes week-2 and week-5 returns once those weeks are complete', () => {
    const fresh = newSolversByWeek(weeks)
    const fields = pendingSolverWeekFields({
      index: 0,
      weeks,
      newSolvers: fresh,
      existing: {},
      lastCompleteDate: '2026-11-01',
    })

    expect(fields).toEqual({
      solvers: '2',
      solver_history_weeks: '0',
      new_solvers: '2',
      new_solvers_week2: '1',
      new_solvers_week5: '1',
    })
  })

  it('leaves out weeks and returns that have not finished', () => {
    const fresh = newSolversByWeek(weeks)
    const fields = pendingSolverWeekFields({
      index: 1,
      weeks,
      newSolvers: fresh,
      existing: { solvers: '2' },
      lastCompleteDate: '2026-10-21',
    })

    expect(fields).toEqual({ new_solvers: '1', new_solvers_week2: '1' })
    expect(
      pendingSolverWeekFields({
        index: 3,
        weeks,
        newSolvers: fresh,
        existing: {},
        lastCompleteDate: '2026-10-21',
      })
    ).toEqual({})
  })
})

describe('detectFunnelIssues', () => {
  it('reports nothing when each funnel stage is no larger than the one before', () => {
    expect(detectFunnelIssues(orderedCounts)).toEqual([])
  })

  it('flags days where a later stage has more unique users', () => {
    expect(detectFunnelIssues({ ...orderedCounts, app_open: 7 })).toEqual([
      'app_open_below_first_input',
    ])
    expect(detectFunnelIssues({ ...orderedCounts, first_input: 4 })).toEqual([
      'first_input_below_submit_success',
    ])
  })
})

describe('buildDailyRecord', () => {
  const base = {
    counts: orderedCounts,
    activeUsers: 11,
    newUsers: 3,
    wrs: 4,
    dqe: 9.4,
    solvesByHour: null,
    recordedAt: '2026-10-22T00:30:00.000Z',
  }

  it('writes the funnel, WRS, DQE and new users as strings', () => {
    expect(buildDailyRecord(base)).toEqual({
      app_open: '10',
      first_input: '8',
      submit_success: '5',
      share_success: '2',
      join_success: '1',
      shop_open: '0',
      active_users: '11',
      new_users: '3',
      wrs: '4',
      dqe: '9.4',
      quality: 'ok',
      recorded_at: '2026-10-22T00:30:00.000Z',
    })
  })

  it('omits WRS and DQE and flags the record when the lookback is incomplete', () => {
    const record = buildDailyRecord({ ...base, wrs: null, dqe: null })

    expect(record.wrs).toBeUndefined()
    expect(record.dqe).toBeUndefined()
    expect(record.quality).toBe('lookback_incomplete')
  })

  it('flags funnel inversions and empty days instead of writing them silently', () => {
    const inverted = buildDailyRecord({
      ...base,
      counts: { ...orderedCounts, app_open: 7 },
    })
    const empty = buildDailyRecord({
      ...base,
      activeUsers: 0,
      newUsers: 0,
      counts: {
        app_open: 0,
        first_input: 0,
        submit_success: 0,
        share_success: 0,
        join_success: 0,
        shop_open: 0,
      },
    })

    expect(inverted.quality).toBe('app_open_below_first_input')
    expect(empty.quality).toBe('no_events')
  })

  it('stores solves per UTC hour when the hourly counter has data', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => (hour === 8 ? 2 : 0))

    expect(buildDailyRecord({ ...base, solvesByHour: hours }).solves_by_hour).toBe(
      JSON.stringify(hours)
    )
  })
})

describe('hourly solve counter', () => {
  it('uses the two-digit UTC hour as the field', () => {
    expect(solveHourField(new Date('2026-10-21T08:59:59.000Z'))).toBe('08')
    expect(solveHourField(new Date('2026-10-21T23:00:00.000Z'))).toBe('23')
  })

  it('expands stored hours into 24 counts and ignores unknown fields', () => {
    const hours = parseSolvesByHour({ '08': '2', '20': '3', noise: '9', '24': '1' })

    expect(hours).toHaveLength(24)
    expect(hours?.[8]).toBe(2)
    expect(hours?.[20]).toBe(3)
    expect(hours?.reduce((total, count) => total + count, 0)).toBe(5)
  })

  it('returns null when no hour was recorded', () => {
    expect(parseSolvesByHour({})).toBeNull()
  })
})

describe('post boards', () => {
  it('reads the slot from the daily post title suffix', () => {
    expect(parsePostSlot('Binary Grid: 2026-10-21 (Morning)')).toBe('Morning')
    expect(parsePostSlot('Binary Grid: 2026-10-21 (Evening)')).toBe('Evening')
    expect(parsePostSlot('Binary Grid: 2026-02-01')).toBe('single')
    expect(parsePostSlot('Binary Grid - 2025-10-20')).toBe('single')
  })

  it('ignores posts that are not daily puzzles', () => {
    expect(parsePostSlot('Binary Grid weekly recap: 2026-W42')).toBeNull()
    expect(parsePostSlot('What is your best time?')).toBeNull()
  })

  it('leaves numbered titles to the stamp, since they carry no slot', () => {
    expect(parsePostSlot('Binary Grid #128')).toBeNull()
  })

  it('reads the slot of a numbered post from its UTC hour, as the old titles did', () => {
    expect(slotOfHour(0)).toBe('Morning')
    expect(slotOfHour(8)).toBe('Morning')
    expect(slotOfHour(13)).toBe('Morning')
    expect(slotOfHour(14)).toBe('Evening')
    expect(slotOfHour(20)).toBe('Evening')
    expect(slotOfHour(23)).toBe('Evening')
  })

  it('sets the sub-floor time at 0.4 s per empty cell', () => {
    expect(subFloorSeconds(19)).toBe(7.6)
    expect(subFloorSeconds(23)).toBe(9.2)
    expect(subFloorSeconds(27)).toBe(10.8)
  })

  it('counts unique solvers per tier and post, and sub-floor times in each top 10', () => {
    const fastEasy = Array.from({ length: 12 }, (_, index) => ({
      member: `t2_e${index}`,
      score: index < 11 ? 5 : 30,
    }))
    const summary = summarizePostBoards(
      {
        easy: fastEasy,
        medium: [
          { member: 't2_e0', score: 9 },
          { member: 't2_m1', score: 9.2 },
          { member: 't2_m2', score: 60 },
        ],
        hard: [],
      },
      { easy: 7.6, medium: 9.2, hard: 10.8 }
    )

    // easy: 11 sub-floor entries but only 10 fit in the top 10; medium: 9 s only
    expect(summary).toEqual({
      tierSolvers: { easy: 12, medium: 3, hard: 0 },
      uniqueSolvers: 14,
      subFloor: 11,
    })
  })

  it('builds the post section with one JSON field per post', () => {
    const section = buildPostSection([
      {
        id: 't3_morning',
        slot: 'Morning',
        hour: 8,
        tierSolvers: { easy: 2, medium: 1, hard: 0 },
        uniqueSolvers: 2,
        subFloor: 1,
      },
      {
        id: 't3_evening',
        slot: 'Evening',
        hour: 20,
        tierSolvers: { easy: 1, medium: 0, hard: 1 },
        uniqueSolvers: 2,
        subFloor: 0,
      },
    ])

    expect(section).toEqual({
      posts_recorded: '2',
      subfloor_top10: '1',
      'post:t3_morning': JSON.stringify({
        slot: 'Morning',
        hour: 8,
        solvers: 2,
        easy: 2,
        medium: 1,
        hard: 0,
        subfloor: 1,
      }),
      'post:t3_evening': JSON.stringify({
        slot: 'Evening',
        hour: 20,
        solvers: 2,
        easy: 1,
        medium: 0,
        hard: 1,
        subfloor: 0,
      }),
    })
    expect(buildPostSection([])).toEqual({ posts_recorded: '0', subfloor_top10: '0' })
  })
})

describe('formatBaselineReadout', () => {
  it('shows the latest WRS, the week’s new users and day-1 retention with cohort size', () => {
    const text = formatBaselineReadout({
      daily: [
        { date: '2026-10-21', fields: { wrs: '42', new_users: '3' } },
        { date: '2026-10-20', fields: { wrs: '40', new_users: '5' } },
        { date: '2026-10-19', fields: { wrs: '39', new_users: '4' } },
        { date: '2026-10-18', fields: { wrs: '38', new_users: '9' } },
      ],
      cohorts: [
        { date: '2026-10-21', fields: { size: '3' } },
        { date: '2026-10-20', fields: { size: '12', d1: '4' } },
      ],
    })

    expect(text).toBe(
      'WRS 42 (2026-10-21) · New users 2026-W43: 12 · Day-1 retention 33% (4 of 12, 2026-10-20)'
    )
  })

  it('pools day-1 retention over the latest seven cohorts that have it', () => {
    const cohorts = listDates('2026-10-13', '2026-10-20').map((date) => ({
      date,
      fields: { size: '2', d1: date === '2026-10-13' ? '2' : '1' },
    }))
    const text = formatBaselineReadout({
      daily: [{ date: '2026-10-21', fields: { wrs: '5', new_users: '2' } }],
      cohorts,
    })

    // 10-14..10-20: 7 of 14 returned; the 10-13 cohort is outside the latest seven
    expect(text).toBe(
      'WRS 5 (2026-10-21) · New users 2026-W43: 2 · Day-1 retention 50% (7 of 14, 2026-10-14 to 2026-10-20)'
    )
  })

  it('falls back to the newest record that has each value', () => {
    const text = formatBaselineReadout({
      daily: [
        { date: '2026-10-20', fields: { wrs: '7', new_users: '2' } },
        { date: '2026-10-21', fields: { new_users: '1' } },
      ],
      cohorts: [{ date: '2026-10-19', fields: { size: '0', d1: '0' } }],
    })

    expect(text).toBe(
      'WRS 7 (2026-10-20) · New users 2026-W43: 3 · Day-1 retention n/a (0 of 0, 2026-10-19)'
    )
  })

  it('marks values the job has not computed yet as pending', () => {
    const text = formatBaselineReadout({
      daily: [{ date: '2026-10-21', fields: { new_users: '1', quality: 'lookback_incomplete' } }],
      cohorts: [{ date: '2026-10-21', fields: { size: '1' } }],
    })

    expect(text).toBe('WRS pending · New users 2026-W43: 1 · Day-1 retention pending')
  })

  it('explains when no record exists yet', () => {
    expect(formatBaselineReadout({ daily: [], cohorts: [] })).toBe(
      'No baseline records yet. The nightly job runs at 00:30 UTC.'
    )
  })
})
