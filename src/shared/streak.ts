import { addDays, daysBetween, toISODate } from './baseline'

// Streaks counted by puzzle (ENGAGEMENT_TASKS.md task 6, D7 (c)). A solve counts
// for #N when it lands within the window after #N's indexed post was created.
// Runs are computed when read, from each player's solve delays, so changing the
// window re-runs the rule and solving order doesn't matter.

export const STREAK_RULES = ['puzzle', 'calendar'] as const

export type StreakRule = (typeof STREAK_RULES)[number]

export const DEFAULT_STREAK_WINDOW_HOURS = 36
export const MIN_STREAK_WINDOW_HOURS = 1
export const MAX_STREAK_WINDOW_HOURS = 168

const SECONDS_PER_HOUR = 60 * 60
const MS_PER_SECOND = 1000
const HOURS_PER_DAY = 24

/** With nothing carried over, a walk reaches back this many days: no older post can be credited. */
export const CREDIT_LOOKBACK_DAYS = Math.ceil(MAX_STREAK_WINDOW_HOURS / HOURS_PER_DAY) + 1

/** A calendar run whose last solve is older than this many days can't still be alive. */
export const SEED_LOOKBACK_DAYS = 14

/** A posted #N: its UTC date, its indexed post, and when that post was created. */
export type PostedNumber = {
  date: string
  number: number
  postId: string
  createdAtMs: number
  /** False when the date stored no puzzles; undefined until checked. */
  playable?: boolean | undefined
}

/** What a player's puzzle-rule streak is computed from. */
export type PlayerRecord = {
  /** #N → seconds from its indexed post's creation to the player's first solve. */
  solveDelays: ReadonlyMap<number, number>
  /** Numbers a spent freeze covered. */
  frozen: ReadonlySet<number>
  freezes: number
  /** The calendar run carried over at seeding, below every walked number. */
  seedRun: number
}

export type StreakClock = { nowMs: number; windowHours: number }

export type NumberStatus = 'credited' | 'open' | 'frozen' | 'skipped' | 'missed'

/** An earlier number the player can still solve for their streak. */
export type StillCountsPointer = { number: number; postId: string; closesAtMs: number }

export type PuzzleStreak = {
  current: number
  /** The newest run as if the gap above it were covered; above `current` once it has ended. */
  lastRun: number
  /** Missed numbers inside the current run, between two counted solves, newest first. */
  toSpend: number[]
  /** Numbers counted as missed before their stored puzzles were checked. */
  unchecked: number[]
  /** The newest posted number is credited (with none, a carried-over run counts). */
  todayCompleted: boolean
  stillCounts: StillCountsPointer | null
}

type ClassifiedNumber = PostedNumber & { status: NumberStatus }

type Walk = { run: number; toSpend: number[]; unchecked: number[] }

const windowMs = (clock: StreakClock): number =>
  clock.windowHours * SECONDS_PER_HOUR * MS_PER_SECOND

export const numberStatus = (
  posted: PostedNumber,
  player: PlayerRecord,
  clock: StreakClock
): NumberStatus => {
  const delaySeconds = player.solveDelays.get(posted.number)
  if (delaySeconds !== undefined && delaySeconds <= clock.windowHours * SECONDS_PER_HOUR) {
    return 'credited'
  }
  if (clock.nowMs < posted.createdAtMs + windowMs(clock)) return 'open'
  if (player.frozen.has(posted.number)) return 'frozen'
  if (posted.playable === false) return 'skipped'
  return 'missed'
}

/**
 * Counts the newest run, newest number first. Missed numbers take freezes; a gap
 * larger than the freezes left ends the run. With `countTopGap` false, misses
 * above the newest solve are ignored, which measures a run that has ended.
 */
const walkRun = (
  numbers: readonly ClassifiedNumber[],
  freezes: number,
  seedRun: number,
  countTopGap: boolean
): Walk => {
  let run = 0
  let freezesLeft = freezes
  let gap: number[] = []
  const toSpend: number[] = []
  const unchecked: number[] = []

  for (const posted of numbers) {
    if (posted.status === 'missed') {
      if (run === 0 && !countTopGap) continue
      gap.push(posted.number)
      if (posted.playable === undefined) unchecked.push(posted.number)
      // Nothing older can join the run once the gap outgrows the freezes.
      if (gap.length > freezesLeft) return { run, toSpend, unchecked }
      continue
    }
    if (posted.status !== 'credited') continue
    freezesLeft -= gap.length
    // The gap above the newest solve stays unspent until a newer solve closes it.
    if (run > 0) toSpend.push(...gap)
    gap = []
    run += 1
  }

  if (seedRun > 0) {
    if (run > 0) toSpend.push(...gap)
    run += seedRun
  }
  return { run, toSpend, unchecked }
}

const findStillCounts = (
  numbers: readonly ClassifiedNumber[],
  clock: StreakClock,
  viewedNumber: number | undefined
): StillCountsPointer | null => {
  // Never the newest number, nor the one the player is looking at.
  const open = numbers
    .slice(1)
    .filter((posted) => posted.status === 'open' && posted.number !== viewedNumber)
  const closesFirst = open.at(-1)
  if (!closesFirst) return null
  return {
    number: closesFirst.number,
    postId: closesFirst.postId,
    closesAtMs: closesFirst.createdAtMs + windowMs(clock),
  }
}

/**
 * A player's puzzle-rule streak from the numbers posted after their seed,
 * newest first. `viewedNumber` is the #N of the post being viewed, if any.
 */
export const computePuzzleStreak = (
  numbers: readonly PostedNumber[],
  player: PlayerRecord,
  clock: StreakClock,
  viewedNumber?: number
): PuzzleStreak => {
  const classified = numbers.map((posted) => ({
    ...posted,
    status: numberStatus(posted, player, clock),
  }))
  const current = walkRun(classified, player.freezes, player.seedRun, true)
  const last = walkRun(classified, player.freezes, player.seedRun, false)
  const newest = classified[0]

  return {
    current: current.run,
    lastRun: last.run,
    toSpend: current.toSpend,
    unchecked: [...new Set([...current.unchecked, ...last.unchecked])],
    todayCompleted: newest ? newest.status === 'credited' : player.seedRun > 0,
    stillCounts: current.run > 0 ? findStillCounts(classified, clock, viewedNumber) : null,
  }
}

/** Today's calendar-rule counters, as stored. */
export type CalendarCounters = {
  current: number
  longest: number
  lastDate: string | null
  freezes: number
}

/** The calendar run a seed carries over, and the freezes charged for days with no post. */
export type SeedPlan = { run: number; charged: number }

const NOTHING_CARRIED: SeedPlan = { run: 0, charged: 0 }

const NO_SOLVES: Omit<PlayerRecord, 'freezes'> = {
  solveDelays: new Map(),
  frozen: new Set(),
  seedRun: 0,
}

/**
 * Decides what a player's first puzzle-rule touch carries over from today's
 * counters. The run carries over when every day since its last solve is a posted
 * number that is still open, a number a freeze can cover, or a day with no
 * posted number, which costs a freeze. `numbers` are the posted numbers dated
 * after `lastDate`, with their puzzles checked.
 */
export const planSeed = (
  { current, lastDate, freezes }: CalendarCounters,
  numbers: readonly PostedNumber[],
  clock: StreakClock
): SeedPlan => {
  if (current <= 0 || !lastDate) return NOTHING_CARRIED
  const today = toISODate(new Date(clock.nowMs))
  const daysSince = daysBetween(lastDate, today)
  if (daysSince <= 0) return { run: current, charged: 0 }
  if (daysSince > SEED_LOOKBACK_DAYS) return NOTHING_CARRIED

  const later = numbers.filter((posted) => posted.date > lastDate)
  const pastPosted = later.filter((posted) => posted.date < today).length
  const daysWithoutPost = daysSince - 1 - pastPosted
  const nobody: PlayerRecord = { ...NO_SOLVES, freezes }
  const missed = later.filter(
    (posted) => numberStatus(posted, nobody, clock) === 'missed'
  ).length

  return daysWithoutPost + missed <= freezes
    ? { run: current, charged: daysWithoutPost }
    : NOTHING_CARRIED
}

/** What a stored seed says about where a player's walk starts. */
export type SeedBounds = { run: number; lastDate: string | null; seededAt: string }

/**
 * The first date a player's walk reads. A carried-over run covers its last
 * calendar solve date and everything before it.
 */
export const walkStartDate = ({ run, lastDate, seededAt }: SeedBounds): string =>
  run > 0 && lastDate
    ? addDays(lastDate, 1)
    : addDays(toISODate(new Date(seededAt)), -CREDIT_LOOKBACK_DAYS)
