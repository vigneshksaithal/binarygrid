import { DAILY_DIFFICULTIES, getUTCWeekId } from './growth'
import type { Difficulty } from './types/puzzle'

// Aggregate math for the analytics baseline (ENGAGEMENT_TASKS.md task 1).
// Inputs are user-ID sets the nightly job holds in memory; every output is a
// count, so nothing built here can put a user ID into a stored record.

export const BASELINE_FUNNEL_EVENTS = [
  'app_open',
  'first_input',
  'submit_success',
  'share_success',
  'join_success',
  'shop_open',
] as const

// Present on every daily record whose funnel fields have been written.
export const RECORDED_AT_FIELD = 'recorded_at'

export type BaselineFunnelEvent = (typeof BASELINE_FUNNEL_EVENTS)[number]
export type FunnelCounts = Readonly<Record<BaselineFunnelEvent, number>>
export type MetricFields = Record<string, string>
export type UsersByDate = ReadonlyMap<string, ReadonlySet<string>>
export type PostSlot = 'Morning' | 'Evening' | 'single'
export type BoardEntry = { member: string; score: number }
export type TierCounts = Record<Difficulty, number>
export type DatedFields = { date: string; fields: Readonly<MetricFields> }

export type WeeklySolvers = {
  weekId: string
  weekStart: string
  weekEnd: string
  solvers: ReadonlySet<string>
}

export type PostBoardSummary = {
  tierSolvers: TierCounts
  uniqueSolvers: number
  subFloor: number
}

export type PostSummary = PostBoardSummary & { id: string; slot: PostSlot; hour: number }

export type DailyRecordInput = {
  counts: FunnelCounts
  activeUsers: number
  newUsers: number
  // null when the seven-day lookback starts before the oldest stored day
  wrs: number | null
  dqe: number | null
  solvesByHour: readonly number[] | null
  recordedAt: string
}

// North Star (B-34): logged-in players who solve on at least 3 of the last 7 UTC days.
const RITUAL_LOOKBACK_DAYS = 7
const RITUAL_MIN_SOLVE_DAYS = 3
const RETENTION_DAY_OFFSETS = [1, 3, 7, 30] as const
// The one return day whose cohort must be re-derived long after `size` was counted.
const MEMBERSHIP_CHECKED_OFFSET = 30
const DAY_30_SKIPPED_FIELD = 'd30_skipped'
const COHORT_CHANGED = 'cohort_changed'
// Weekly solver cohorts: returns in the following week and in the cohort's fifth week.
const SOLVER_RETURN_WEEKS = [
  { offset: 1, field: 'new_solvers_week2' },
  { offset: 4, field: 'new_solvers_week5' },
] as const
const DAYS_PER_WEEK = 7
const HOURS_PER_DAY = 24
const MS_PER_DAY = 86_400_000
const PERCENT = 100
const TOP_BOARD_SIZE = 10
// Times under about 0.4 s per empty cell are implausible (report I5, GP R4).
const SUB_FLOOR_SECONDS_PER_EMPTY_CELL = 0.4
const READOUT_COHORT_DAYS = 7
const QUALITY_OK = 'ok'
const LOOKBACK_INCOMPLETE = 'lookback_incomplete'
const NO_EVENTS = 'no_events'
// Keep in sync with the `baseline-nightly` cron in devvit.json.
export const NO_RECORDS_MESSAGE = 'No baseline records yet. The nightly job runs at 00:30 UTC.'
// Report I4's data-quality check: unique app_open >= first_input >= submit_success.
const FUNNEL_ORDER = [
  ['app_open', 'first_input'],
  ['first_input', 'submit_success'],
] as const
// Daily post titles across versions of src/server/core/post.ts:
// "Binary Grid: 2026-10-21 (Morning)" since 2026-03-29, "Binary Grid: 2026-02-01"
// for the single daily post before that, and "Binary Grid - 2025-10-20" earlier.
const DAILY_POST_TITLE = /^Binary Grid(?::| -) \d{4}-\d{2}-\d{2}(?: \((Morning|Evening)\))?$/
const HOUR_FIELD = /^\d{2}$/
const COUNT_VALUE = /^\d+$/

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0)

export const roundToTenth = (value: number): number => Math.round(value * 10) / 10

const hasFields = (fields: Readonly<MetricFields>): boolean => Object.keys(fields).length > 0

// ── Dates (UTC, YYYY-MM-DD) ─────────────────────────────────────────────────

const parseISODate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`)

export const toISODate = (date: Date): string => date.toISOString().slice(0, 10)

export const addDays = (isoDate: string, days: number): string =>
  toISODate(new Date(parseISODate(isoDate).getTime() + days * MS_PER_DAY))

export const daysBetween = (from: string, to: string): number =>
  Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / MS_PER_DAY)

export const listDates = (first: string, last: string): string[] =>
  Array.from({ length: Math.max(daysBetween(first, last) + 1, 0) }, (_, offset) =>
    addDays(first, offset)
  )

export const weekStartOf = (isoDate: string): string => {
  const isoWeekday = parseISODate(isoDate).getUTCDay() || DAYS_PER_WEEK
  return addDays(isoDate, 1 - isoWeekday)
}

export const weekIdOf = (isoDate: string): string => getUTCWeekId(parseISODate(isoDate))

// ── WRS and the DQE readout ─────────────────────────────────────────────────

const lookbackDates = (endDate: string): string[] =>
  listDates(addDays(endDate, 1 - RITUAL_LOOKBACK_DAYS), endDate)

export const isLookbackComplete = (endDate: string, windowStart: string): boolean =>
  addDays(endDate, 1 - RITUAL_LOOKBACK_DAYS) >= windowStart

export const countRitualSolvers = (solversByDate: UsersByDate, endDate: string): number => {
  const solveDays = new Map<string, number>()
  for (const date of lookbackDates(endDate)) {
    for (const user of solversByDate.get(date) ?? []) {
      solveDays.set(user, (solveDays.get(user) ?? 0) + 1)
    }
  }
  return [...solveDays.values()].filter((days) => days >= RITUAL_MIN_SOLVE_DAYS).length
}

// DQE readout (B-43): the 7-day average of daily unique logged-in openers, our
// approximation of Reddit's Daily Qualified Engagers. Report it; never target it.
export const averageDailyOpeners = (openersByDate: UsersByDate, endDate: string): number => {
  const dates = lookbackDates(endDate)
  const openers = sum(dates.map((date) => openersByDate.get(date)?.size ?? 0))
  return roundToTenth(openers / dates.length)
}

// ── First-seen cohorts ──────────────────────────────────────────────────────

// A weekly board shows who solved in a week, not on which day. A board for a week
// that starts before the hash window proves a solve before the window, unless the
// player also solved on one of that week's in-window days; then the hashes decide.
export const findPreWindowSolvers = ({
  windowStart,
  weeks,
  solversByDate,
}: {
  windowStart: string
  weeks: readonly WeeklySolvers[]
  solversByDate: UsersByDate
}): Set<string> => {
  const known = new Set<string>()
  for (const week of weeks.filter((candidate) => candidate.weekStart < windowStart)) {
    const inWindowDays = listDates(windowStart, week.weekEnd)
    for (const user of week.solvers) {
      if (!inWindowDays.some((date) => solversByDate.get(date)?.has(user))) known.add(user)
    }
  }
  return known
}

// Each user joins the cohort of the first date they appear, unless they are known
// from before the window. Every date in `activeByDate` gets a cohort, even if empty.
export const assignCohorts = (
  activeByDate: UsersByDate,
  knownUsers: ReadonlySet<string>
): Map<string, Set<string>> => {
  const seen = new Set(knownUsers)
  const cohorts = new Map<string, Set<string>>()
  for (const date of [...activeByDate.keys()].sort()) {
    const cohort = new Set<string>()
    for (const user of activeByDate.get(date) ?? []) {
      if (seen.has(user)) continue
      seen.add(user)
      cohort.add(user)
    }
    cohorts.set(date, cohort)
  }
  return cohorts
}

export const countReturned = (
  cohort: ReadonlySet<string>,
  active: ReadonlySet<string> | undefined
): number => [...cohort].filter((user) => active?.has(user)).length

type CohortInput = {
  date: string
  existing: Readonly<MetricFields>
  members: ReadonlySet<string>
  activeByDate: UsersByDate
  lastCompleteDate: string
  historyDays: number
}

// A later night re-derives the cohort from a window that has lost its oldest days,
// so the cohort can gain players whose earlier visit expired after `size` was
// counted. For days 1 to 7 that takes a 52-58 day gap plus a return within the
// week, which is negligible. For day 30 a 29-58 day gap is enough, so day 30 is
// written only while the re-derived cohort still has exactly `size` members.
const hasCohortChanged = ({ existing, members }: CohortInput): boolean =>
  existing.size !== undefined && Number(existing.size) !== members.size

const pendingReturnFields = (input: CohortInput): MetricFields => {
  const { date, existing, members, activeByDate, lastCompleteDate } = input
  const fields: MetricFields = {}
  for (const offset of RETENTION_DAY_OFFSETS) {
    const field = `d${offset}`
    const returnDate = addDays(date, offset)
    if (existing[field] !== undefined || returnDate > lastCompleteDate) continue
    if (offset === MEMBERSHIP_CHECKED_OFFSET && hasCohortChanged(input)) {
      if (existing[DAY_30_SKIPPED_FIELD] === undefined) {
        fields[DAY_30_SKIPPED_FIELD] = COHORT_CHANGED
      }
      continue
    }
    fields[field] = String(countReturned(members, activeByDate.get(returnDate)))
  }
  return fields
}

// Fields a cohort record still lacks: size once, then each day-N return count
// once day N has completed. Existing fields are never rewritten.
export const pendingCohortFields = (input: CohortInput): MetricFields => {
  const fields: MetricFields = {}
  if (input.existing.size === undefined) {
    fields.size = String(input.members.size)
    fields.history_days = String(input.historyDays)
  }
  return { ...fields, ...pendingReturnFields(input) }
}

const COHORT_WEEK_FIELDS: readonly (readonly [string, (values: readonly number[]) => number])[] = [
  ['size', sum],
  ['history_days', (values) => Math.min(...values)],
  ...RETENTION_DAY_OFFSETS.map((offset) => [`d${offset}`, sum] as const),
]

// A weekly cohort adds up its seven daily cohorts, field by field, once every
// day of the week has that field.
export const sumCohortWeek = (
  existing: Readonly<MetricFields>,
  dailyCohorts: readonly (Readonly<MetricFields> | undefined)[]
): MetricFields => {
  const fields: MetricFields = {}
  if (dailyCohorts.length !== DAYS_PER_WEEK) return fields
  for (const [field, combine] of COHORT_WEEK_FIELDS) {
    const values = dailyCohorts.map((cohort) => cohort?.[field])
    if (existing[field] !== undefined || values.some((value) => value === undefined)) continue
    fields[field] = String(combine(values.map(Number)))
  }
  return fields
}

// Weeks must be in calendar order: a solver is new in the first week they appear.
export const newSolversByWeek = (weeks: readonly WeeklySolvers[]): Map<string, Set<string>> => {
  const seen = new Set<string>()
  const newcomersByWeek = new Map<string, Set<string>>()
  for (const week of weeks) {
    const newcomers = new Set([...week.solvers].filter((user) => !seen.has(user)))
    for (const user of newcomers) seen.add(user)
    newcomersByWeek.set(week.weekId, newcomers)
  }
  return newcomersByWeek
}

export const pendingSolverWeekFields = ({
  index,
  weeks,
  newSolvers,
  existing,
  lastCompleteDate,
}: {
  index: number
  weeks: readonly WeeklySolvers[]
  newSolvers: ReadonlyMap<string, ReadonlySet<string>>
  existing: Readonly<MetricFields>
  lastCompleteDate: string
}): MetricFields => {
  const fields: MetricFields = {}
  const week = weeks[index]
  if (!week || week.weekEnd > lastCompleteDate) return fields
  const newcomers = newSolvers.get(week.weekId) ?? new Set<string>()
  if (existing.solvers === undefined) {
    fields.solvers = String(week.solvers.size)
    // Earlier boards to compare against; the first weeks' new solvers include veterans.
    fields.solver_history_weeks = String(index)
  }
  if (existing.new_solvers === undefined) fields.new_solvers = String(newcomers.size)
  for (const { offset, field } of SOLVER_RETURN_WEEKS) {
    const later = weeks[index + offset]
    if (existing[field] !== undefined || !later || later.weekEnd > lastCompleteDate) continue
    fields[field] = String(countReturned(newcomers, later.solvers))
  }
  return fields
}

// ── Daily record ────────────────────────────────────────────────────────────

export const detectFunnelIssues = (counts: FunnelCounts): string[] =>
  FUNNEL_ORDER.filter(([earlier, later]) => counts[earlier] < counts[later]).map(
    ([earlier, later]) => `${earlier}_below_${later}`
  )

const qualityOf = (input: DailyRecordInput): string => {
  const issues = detectFunnelIssues(input.counts)
  if (input.wrs === null || input.dqe === null) issues.push(LOOKBACK_INCOMPLETE)
  if (input.activeUsers === 0) issues.push(NO_EVENTS)
  return issues.length > 0 ? issues.join(',') : QUALITY_OK
}

export const buildDailyRecord = (input: DailyRecordInput): MetricFields => {
  const fields: MetricFields = {}
  for (const event of BASELINE_FUNNEL_EVENTS) fields[event] = String(input.counts[event])
  fields.active_users = String(input.activeUsers)
  fields.new_users = String(input.newUsers)
  if (input.wrs !== null) fields.wrs = String(input.wrs)
  if (input.dqe !== null) fields.dqe = String(input.dqe)
  if (input.solvesByHour !== null) fields.solves_by_hour = JSON.stringify(input.solvesByHour)
  fields.quality = qualityOf(input)
  fields[RECORDED_AT_FIELD] = input.recordedAt
  return fields
}

// ── Hourly solve counter ────────────────────────────────────────────────────

export const solveHourField = (date: Date): string =>
  String(date.getUTCHours()).padStart(2, '0')

const isHourEntry = ([field, value]: readonly [string, string]): boolean =>
  HOUR_FIELD.test(field) && Number(field) < HOURS_PER_DAY && COUNT_VALUE.test(value)

// Returns 24 counts (index = UTC hour), or null when the day has no hourly data,
// which is every day before the counter shipped.
export const parseSolvesByHour = (stored: Readonly<Record<string, string>>): number[] | null => {
  const entries = Object.entries(stored).filter(isHourEntry)
  if (entries.length === 0) return null
  const hours = Array.from({ length: HOURS_PER_DAY }, () => 0)
  for (const [field, value] of entries) hours[Number(field)] = Number(value)
  return hours
}

// ── Posts ───────────────────────────────────────────────────────────────────

export const parsePostSlot = (title: string): PostSlot | null => {
  const match = DAILY_POST_TITLE.exec(title)
  if (!match) return null
  const suffix = match[1]
  return suffix === 'Morning' || suffix === 'Evening' ? suffix : 'single'
}

export const subFloorSeconds = (emptyCells: number): number =>
  roundToTenth(emptyCells * SUB_FLOOR_SECONDS_PER_EMPTY_CELL)

const countSubFloor = (board: readonly BoardEntry[], floorSeconds: number): number =>
  board.slice(0, TOP_BOARD_SIZE).filter((entry) => entry.score < floorSeconds).length

// Boards are in rank order (fastest first), so the first ten entries are the top 10.
export const summarizePostBoards = (
  boards: Readonly<Record<Difficulty, readonly BoardEntry[]>>,
  floors: Readonly<TierCounts>
): PostBoardSummary => ({
  tierSolvers: {
    easy: boards.easy.length,
    medium: boards.medium.length,
    hard: boards.hard.length,
  },
  uniqueSolvers: new Set(DAILY_DIFFICULTIES.flatMap((tier) => boards[tier].map((e) => e.member)))
    .size,
  subFloor: sum(DAILY_DIFFICULTIES.map((tier) => countSubFloor(boards[tier], floors[tier]))),
})

export const buildPostSection = (posts: readonly PostSummary[]): MetricFields => {
  const fields: MetricFields = {
    posts_recorded: String(posts.length),
    subfloor_top10: String(sum(posts.map((post) => post.subFloor))),
  }
  for (const post of posts) {
    fields[`post:${post.id}`] = JSON.stringify({
      slot: post.slot,
      hour: post.hour,
      solvers: post.uniqueSolvers,
      easy: post.tierSolvers.easy,
      medium: post.tierSolvers.medium,
      hard: post.tierSolvers.hard,
      subfloor: post.subFloor,
    })
  }
  return fields
}

// ── Moderator readout ───────────────────────────────────────────────────────

// Drops empty records (dates the job never wrote) and sorts the rest newest first.
export const newestFirst = (records: readonly DatedFields[]): DatedFields[] =>
  records.filter((record) => hasFields(record.fields)).sort((a, b) => b.date.localeCompare(a.date))

const describeWrs = (daily: readonly DatedFields[]): string => {
  const latest = daily.find((record) => record.fields.wrs !== undefined)
  return latest ? `WRS ${latest.fields.wrs} (${latest.date})` : 'WRS pending'
}

const describeNewUsers = (daily: readonly DatedFields[], newestDate: string): string => {
  const weekId = weekIdOf(newestDate)
  const inWeek = daily.filter((record) => weekIdOf(record.date) === weekId)
  return `New users ${weekId}: ${sum(inWeek.map((record) => Number(record.fields.new_users ?? 0)))}`
}

// Pools the latest seven cohorts with a day-1 count; single days are too small to read.
const describeDayOneRetention = (cohorts: readonly DatedFields[]): string => {
  const recent = cohorts
    .filter((record) => record.fields.size !== undefined && record.fields.d1 !== undefined)
    .slice(0, READOUT_COHORT_DAYS)
  const newest = recent[0]
  const oldest = recent.at(-1)
  if (!newest || !oldest) return 'Day-1 retention pending'
  const size = sum(recent.map((record) => Number(record.fields.size)))
  const returned = sum(recent.map((record) => Number(record.fields.d1)))
  const rate = size > 0 ? `${Math.round((returned / size) * PERCENT)}%` : 'n/a'
  const span = oldest.date === newest.date ? newest.date : `${oldest.date} to ${newest.date}`
  return `Day-1 retention ${rate} (${returned} of ${size}, ${span})`
}

export const formatBaselineReadout = ({
  daily,
  cohorts,
}: {
  daily: readonly DatedFields[]
  cohorts: readonly DatedFields[]
}): string => {
  const days = newestFirst(daily)
  const newest = days[0]
  if (!newest) return NO_RECORDS_MESSAGE
  return [
    describeWrs(days),
    describeNewUsers(days, newest.date),
    describeDayOneRetention(newestFirst(cohorts)),
  ].join(' · ')
}
