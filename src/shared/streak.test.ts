import { describe, expect, it } from 'vitest'
import { addDays } from './baseline'
import {
  computePuzzleStreak,
  numberStatus,
  planSeed,
  walkStartDate,
  type PlayerRecord,
  type PostedNumber,
  type StreakClock,
} from './streak'

const HOUR_MS = 60 * 60 * 1000
const HOUR_SECONDS = 60 * 60

// #N posts at 08:00 UTC on 2026-10-(N − 106): #126 Tuesday 20th, #127 Wednesday, #128 Thursday.
const dateOf = (number: number): string => addDays('2026-10-20', number - 126)
const postedAtMs = (number: number): number => Date.parse(`${dateOf(number)}T08:00:00Z`)

const posted = (number: number, playable = true): PostedNumber => ({
  date: dateOf(number),
  number,
  postId: `t3_post${number}`,
  createdAtMs: postedAtMs(number),
  playable,
})

/** Posted numbers from `newest` down to `oldest`, newest first, as a walk reads them. */
const postedRange = (newest: number, oldest: number): PostedNumber[] =>
  Array.from({ length: newest - oldest + 1 }, (_, offset) => posted(newest - offset))

const player = ({
  solved = {},
  frozen = [],
  freezes = 0,
  seedRun = 0,
}: {
  /** #N → hours after posting that the player first solved it. */
  solved?: Record<number, number>
  frozen?: number[]
  freezes?: number
  seedRun?: number
} = {}): PlayerRecord => ({
  solveDelays: new Map(
    Object.entries(solved).map(([number, hours]) => [Number(number), hours * HOUR_SECONDS])
  ),
  frozen: new Set(frozen),
  freezes,
  seedRun,
})

/** The clock `hours` after #N posted, with a 36-hour window unless given. */
const hoursAfter = (number: number, hours: number, windowHours = 36): StreakClock => ({
  nowMs: postedAtMs(number) + hours * HOUR_MS,
  windowHours,
})

/** Solved every number from `first` to `last`, each two hours after it posted. */
const solvedEach = (first: number, last: number): Record<number, number> =>
  Object.fromEntries(
    Array.from({ length: last - first + 1 }, (_, offset) => [first + offset, 2])
  )

describe('numberStatus', () => {
  it('credits a solve 35 hours after posting and not one 37 hours after, with a 36-hour window', () => {
    const clock = hoursAfter(127, 40)

    expect(numberStatus(posted(127), player({ solved: { 127: 35 } }), clock)).toBe('credited')
    expect(numberStatus(posted(127), player({ solved: { 127: 37 } }), clock)).toBe('missed')
  })

  it('credits the 37-hour solve once the window is 48 hours', () => {
    const late = player({ solved: { 127: 37 } })

    expect(numberStatus(posted(127), late, hoursAfter(127, 60, 48))).toBe('credited')
  })

  it('keeps an unsolved number open until its window closes', () => {
    expect(numberStatus(posted(127), player(), hoursAfter(127, 35.9))).toBe('open')
    expect(numberStatus(posted(127), player(), hoursAfter(127, 36))).toBe('missed')
  })

  it('treats a closed number as frozen once a freeze covered it', () => {
    expect(numberStatus(posted(127), player({ frozen: [127] }), hoursAfter(127, 40))).toBe('frozen')
  })

  it('skips a closed number whose date stored no puzzles', () => {
    expect(numberStatus(posted(127, false), player(), hoursAfter(127, 40))).toBe('skipped')
  })
})

describe('computePuzzleStreak runs', () => {
  it('counts every credited number in a row', () => {
    const streak = computePuzzleStreak(
      postedRange(128, 120),
      player({ solved: solvedEach(120, 128) }),
      hoursAfter(128, 3)
    )

    expect(streak).toMatchObject({ current: 9, lastRun: 9, toSpend: [], todayCompleted: true })
  })

  it('keeps the streak and spends no freeze when #128 is solved before #127', () => {
    const numbers = postedRange(128, 120)
    const before127 = player({ solved: { ...solvedEach(120, 126), 128: 2 } })
    const after127 = player({ solved: { ...solvedEach(120, 126), 128: 2, 127: 28 } })

    expect(computePuzzleStreak(numbers, before127, hoursAfter(128, 3))).toMatchObject({
      current: 8,
      toSpend: [],
    })
    expect(computePuzzleStreak(numbers, after127, hoursAfter(128, 5))).toMatchObject({
      current: 9,
      toSpend: [],
    })
  })

  it('covers two missed numbers with two freezes', () => {
    const missedTwo = { ...solvedEach(120, 124), 127: 2, 128: 2 }

    const streak = computePuzzleStreak(
      postedRange(128, 120),
      player({ solved: missedTwo, freezes: 2 }),
      hoursAfter(128, 3)
    )

    expect(streak).toMatchObject({ current: 7, toSpend: [126, 125] })
  })

  it('ends the run when two numbers are missed with one freeze', () => {
    const missedTwo = { ...solvedEach(120, 124), 127: 2, 128: 2 }

    const streak = computePuzzleStreak(
      postedRange(128, 120),
      player({ solved: missedTwo, freezes: 1 }),
      hoursAfter(128, 3)
    )

    expect(streak).toMatchObject({ current: 2, toSpend: [] })
  })

  it('skips a number whose date stored no puzzles instead of breaking the run', () => {
    const numbers = postedRange(128, 120).map((day) => (day.number === 125 ? posted(125, false) : day))
    const solved = { ...solvedEach(120, 124), 127: 2, 128: 2 }

    const streak = computePuzzleStreak(numbers, player({ solved, freezes: 1 }), hoursAfter(128, 3))

    expect(streak).toMatchObject({ current: 7, toSpend: [126] })
  })

  it('keeps a run alive while freezes can cover the gap above it, without spending them', () => {
    const streak = computePuzzleStreak(
      postedRange(128, 120),
      player({ solved: solvedEach(120, 126), freezes: 1 }),
      hoursAfter(128, 13)
    )

    expect(streak).toMatchObject({ current: 7, toSpend: [] })
  })

  it('reports a run that ended as the last run, with no current streak', () => {
    const streak = computePuzzleStreak(
      postedRange(128, 120),
      player({ solved: solvedEach(120, 124), freezes: 2 }),
      hoursAfter(128, 13)
    )

    expect(streak).toMatchObject({ current: 0, lastRun: 5 })
  })

  it("doesn't count solves after the window, so late replays and old posts don't extend a run", () => {
    const lateSolves = { ...solvedEach(125, 128), 124: 40, 120: 190 }

    const streak = computePuzzleStreak(
      postedRange(128, 120),
      player({ solved: lateSolves }),
      hoursAfter(128, 3)
    )

    expect(streak.current).toBe(4)
  })

  it('re-runs the rule when the window changes', () => {
    const late127 = player({ solved: { ...solvedEach(120, 126), 127: 40, 128: 2 } })

    expect(computePuzzleStreak(postedRange(128, 120), late127, hoursAfter(128, 18)).current).toBe(1)
    expect(computePuzzleStreak(postedRange(128, 120), late127, hoursAfter(128, 18, 48)).current).toBe(9)
  })

  it('adds the seeded run below the posted numbers', () => {
    const streak = computePuzzleStreak(
      postedRange(128, 126),
      player({ solved: solvedEach(126, 128), seedRun: 10 }),
      hoursAfter(128, 3)
    )

    expect(streak).toMatchObject({ current: 13, lastRun: 13 })
  })

  it('spends a freeze on a number missed between a credit and the seeded run', () => {
    const streak = computePuzzleStreak(
      postedRange(128, 126),
      player({ solved: solvedEach(127, 128), seedRun: 10, freezes: 1 }),
      hoursAfter(128, 3)
    )

    expect(streak).toMatchObject({ current: 12, toSpend: [126] })
  })

  it('lists missed numbers it counted before their puzzles were checked', () => {
    const numbers = postedRange(128, 120).map((day) =>
      day.number === 126 ? { ...day, playable: undefined } : day
    )
    const solved = { ...solvedEach(120, 125), 127: 2, 128: 2 }

    const streak = computePuzzleStreak(numbers, player({ solved }), hoursAfter(128, 3))

    expect(streak).toMatchObject({ current: 2, unchecked: [126] })
  })

  it('marks today completed only when the newest posted number is credited', () => {
    const numbers = postedRange(128, 126)

    expect(
      computePuzzleStreak(numbers, player({ solved: solvedEach(126, 127) }), hoursAfter(128, 3))
        .todayCompleted
    ).toBe(false)
  })
})

describe('computePuzzleStreak still counts', () => {
  const numbers = postedRange(128, 120)
  const streakTo126 = { ...solvedEach(120, 126), 128: 2 }

  it("points to yesterday's number while it is unsolved and its window is open", () => {
    const streak = computePuzzleStreak(numbers, player({ solved: streakTo126 }), hoursAfter(128, 3))

    expect(streak.stillCounts).toEqual({
      number: 127,
      postId: 't3_post127',
      closesAtMs: postedAtMs(127) + 36 * HOUR_MS,
    })
  })

  it('points nowhere once #127 is solved or its window closes', () => {
    const solved127 = player({ solved: { ...streakTo126, 127: 26 } })

    expect(computePuzzleStreak(numbers, solved127, hoursAfter(128, 3)).stillCounts).toBeNull()
    expect(
      computePuzzleStreak(numbers, player({ solved: streakTo126, freezes: 1 }), hoursAfter(128, 13))
        .stillCounts
    ).toBeNull()
  })

  it("never points at the newest number or at the post being viewed", () => {
    const solvedTo127 = player({ solved: solvedEach(120, 127) })

    expect(computePuzzleStreak(numbers, solvedTo127, hoursAfter(128, 3)).stillCounts).toBeNull()
    expect(
      computePuzzleStreak(numbers, player({ solved: streakTo126 }), hoursAfter(128, 3), 127)
        .stillCounts
    ).toBeNull()
  })

  it('points nowhere when there is no streak to keep', () => {
    expect(computePuzzleStreak(numbers, player(), hoursAfter(128, 3)).stillCounts).toBeNull()
  })

  it('points to the number that closes first when two are open', () => {
    const streak = computePuzzleStreak(
      numbers,
      player({ solved: solvedEach(120, 125) }),
      hoursAfter(128, 3, 72)
    )

    expect(streak.stillCounts?.number).toBe(126)
  })
})

describe('planSeed', () => {
  // Seeding 3 hours after #128 posted, on Thursday 2026-10-22.
  const seedClock = hoursAfter(128, 3)
  const counters = (lastDate: string | null, freezes = 0, current = 10) => ({
    current,
    longest: 23,
    lastDate,
    freezes,
  })

  it.each([
    ['solved today', counters('2026-10-22'), []],
    ['solved yesterday', counters('2026-10-21'), [posted(128)]],
    ['solved two days ago, with yesterday still open', counters('2026-10-20'), postedRange(128, 127)],
  ])('carries the run over unchanged when the player %s', (_case, stored, numbers) => {
    expect(planSeed(stored, numbers, seedClock)).toEqual({ run: 10, charged: 0 })
  })

  it('charges a freeze for each earlier day that had no posted number', () => {
    expect(planSeed(counters('2026-10-20', 1), [posted(128)], seedClock)).toEqual({
      run: 10,
      charged: 1,
    })
    expect(planSeed(counters('2026-10-19', 2), [posted(128)], seedClock)).toEqual({
      run: 10,
      charged: 2,
    })
  })

  it('leaves a missed posted number for the next solve to cover', () => {
    const lateClock = hoursAfter(128, 13)

    expect(planSeed(counters('2026-10-20', 1), postedRange(128, 127), lateClock)).toEqual({
      run: 10,
      charged: 0,
    })
  })

  it("doesn't count a posted number that stored no puzzles", () => {
    const lateClock = hoursAfter(128, 13)

    expect(planSeed(counters('2026-10-20'), [posted(128), posted(127, false)], lateClock)).toEqual({
      run: 10,
      charged: 0,
    })
  })

  it.each([
    ['more missed days than freezes', counters('2026-10-19', 1), [posted(128)], seedClock],
    ['a missed posted number and no freeze', counters('2026-10-20'), postedRange(128, 127), hoursAfter(128, 13)],
    ['a last solve more than 14 days ago', counters('2026-10-07', 2), [], seedClock],
    ['no current streak', counters('2026-10-21', 2, 0), [posted(128)], seedClock],
    ['no last solve date', counters(null, 2), [], seedClock],
  ])('carries nothing over with %s', (_case, stored, numbers, clock) => {
    expect(planSeed(stored, numbers, clock)).toEqual({ run: 0, charged: 0 })
  })

  it.each([
    ['solved today', counters('2026-10-22'), [], seedClock],
    ['solved yesterday', counters('2026-10-21', 1), [posted(128)], seedClock],
    ['skipped a day with no post', counters('2026-10-20', 1), [posted(128)], seedClock],
    ['skipped two days with no post', counters('2026-10-19', 2), [posted(128)], seedClock],
    ['missed a posted number', counters('2026-10-20', 1), postedRange(128, 127), hoursAfter(128, 13)],
  ])('computes the stored streak right after seeding a player who %s', (_case, stored, numbers, clock) => {
    const seed = planSeed(stored, numbers, clock)
    const seeded = player({ seedRun: seed.run, freezes: stored.freezes - seed.charged })

    expect(computePuzzleStreak(numbers, seeded, clock).current).toBe(stored.current)
  })
})

describe('walkStartDate', () => {
  it('starts the day after the last calendar solve when a run carried over', () => {
    expect(walkStartDate({ run: 10, lastDate: '2026-10-20', seededAt: '2026-10-22T11:00:00.000Z' })).toBe(
      '2026-10-21'
    )
  })

  it('starts as far back as a solve can still be credited when nothing carried over', () => {
    expect(walkStartDate({ run: 0, lastDate: '2026-10-01', seededAt: '2026-10-22T11:00:00.000Z' })).toBe(
      '2026-10-14'
    )
  })
})
