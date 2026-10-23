import { context, reddit, redis } from '@devvit/web/server'
import {
  addDays,
  assignCohorts,
  averageDailyOpeners,
  buildDailyRecord,
  buildPostSection,
  countRitualSolvers,
  type DatedFields,
  daysBetween,
  findPreWindowSolvers,
  formatBaselineReadout,
  type FunnelCounts,
  isLookbackComplete,
  listDates,
  type MetricFields,
  newSolversByWeek,
  parsePostSlot,
  parseSolvesByHour,
  pendingCohortFields,
  pendingSolverWeekFields,
  type PostSlot,
  type PostSummary,
  RECORDED_AT_FIELD,
  solveHourField,
  subFloorSeconds,
  sumCohortWeek,
  summarizePostBoards,
  toISODate,
  type UsersByDate,
  weekIdOf,
  type WeeklySolvers,
  weekStartOf,
} from '../../shared/baseline'
import { DAILY_DIFFICULTIES } from '../../shared/growth'
import { SIZE } from '../../shared/rules'
import type { Difficulty } from '../../shared/types/puzzle'
import { ANALYTICS_TTL_SECONDS, GROWTH_EVENT_NAMES, type GrowthEventName } from '../lib/growth'
import { leaderboardKey } from '../routes/utils'
import { getClueTarget } from './generator'

// Nightly analytics baseline (ENGAGEMENT_TASKS.md task 1). Reads the expiring
// daily:{date}:unique:{event} hashes, the weekly boards and the per-post boards,
// keeps user IDs in memory only, and writes aggregate metrics:* records with no TTL.

export type BaselineRunSummary = {
  dailyRecords: number
  cohortRecords: number
  weekRecords: number
  postDates: number
}

export type BaselineRunOptions = { maxPostsPerRun?: number }

type BaselineWindow = { start: string; end: string; dates: string[] }

type Activity = {
  byEvent: ReadonlyMap<GrowthEventName, UsersByDate>
  activeByDate: UsersByDate
}

type BaselineRun = {
  recordedAt: string
  window: BaselineWindow
  activity: Activity
  weeks: readonly WeeklySolvers[]
  cohorts: ReadonlyMap<string, ReadonlySet<string>>
}

type PendingPost = { id: string; date: string; slot: PostSlot; hour: number }

const SECONDS_PER_DAY = 86_400
const DAYS_PER_WEEK = 7
// A daily:{date}:unique:{event} hash expires 60 days after its last write, so at
// 00:30 the day 60 days back may already be partly gone. Read the 59 complete days.
const WINDOW_DAYS = ANALYTICS_TTL_SECONDS / SECONDS_PER_DAY - 1
// Per-post counts wait a week so morning and evening posts are compared at a similar age.
const POST_SETTLE_DAYS = 7
// Bounds the first run's post backfill; the cursor resumes the rest on later nights.
const DEFAULT_MAX_POSTS_PER_RUN = 300
const POST_LISTING_LIMIT = 1000
const POST_LISTING_PAGE_SIZE = 100
// Weekly tier boards exist since commit a65819a (2026-05-15) and never expire.
const WEEKLY_BOARDS_SINCE = '2026-05-15'
const READOUT_DAYS = 14
const BASELINE_STATE_KEY = 'metrics:baseline:state'
const POSTS_THROUGH_FIELD = 'posts_through'
const TOTAL_CELLS = SIZE * SIZE
const SUB_FLOOR_SECONDS: Record<Difficulty, number> = {
  easy: subFloorSeconds(TOTAL_CELLS - getClueTarget('easy')),
  medium: subFloorSeconds(TOTAL_CELLS - getClueTarget('medium')),
  hard: subFloorSeconds(TOTAL_CELLS - getClueTarget('hard')),
}
const NO_USERS: UsersByDate = new Map()

const uniqueEventKey = (date: string, event: GrowthEventName): string =>
  `daily:${date}:unique:${event}`
const hourlySolvesKey = (date: string): string => `daily:${date}:hourly:submit_success`
const weeklyBoardKey = (weekId: string, tier: Difficulty): string =>
  `leaderboard:weekly:${weekId}:${tier}`
const dailyMetricsKey = (date: string): string => `metrics:daily:${date}`
const cohortMetricsKey = (date: string): string => `metrics:cohort:${date}`
const cohortWeekMetricsKey = (weekId: string): string => `metrics:cohort-week:${weekId}`

// Called once per successful submit (src/server/routes/submit.ts). The nightly
// job copies each day's counts into metrics:daily:{date}.solves_by_hour.
export const recordHourlySolve = async (now: Date = new Date()): Promise<void> => {
  const key = hourlySolvesKey(toISODate(now))
  await redis.hIncrBy(key, solveHourField(now), 1)
  await redis.expire(key, ANALYTICS_TTL_SECONDS)
}

// ── Reads ───────────────────────────────────────────────────────────────────

const baselineWindow = (now: Date): BaselineWindow => {
  const today = toISODate(now)
  const start = addDays(today, -WINDOW_DAYS)
  const end = addDays(today, -1)
  return { start, end, dates: listDates(start, end) }
}

const loadEventUsers = async (
  event: GrowthEventName,
  dates: readonly string[]
): Promise<UsersByDate> => {
  const users = await Promise.all(dates.map((date) => redis.hKeys(uniqueEventKey(date, event))))
  return new Map(dates.map((date, index) => [date, new Set(users[index])]))
}

const usersOnDate = (maps: readonly UsersByDate[], date: string): Set<string> =>
  new Set(maps.flatMap((byDate) => [...(byDate.get(date) ?? [])]))

const unionByDate = (dates: readonly string[], maps: readonly UsersByDate[]): UsersByDate =>
  new Map(dates.map((date) => [date, usersOnDate(maps, date)]))

// "Seen" means any growth event; only logged-in users reach these hashes.
const loadActivity = async (dates: readonly string[]): Promise<Activity> => {
  const byEvent = new Map<GrowthEventName, UsersByDate>()
  for (const event of GROWTH_EVENT_NAMES) byEvent.set(event, await loadEventUsers(event, dates))
  return { byEvent, activeByDate: unionByDate(dates, [...byEvent.values()]) }
}

const loadWeekSolvers = async (weekStart: string): Promise<WeeklySolvers> => {
  const weekId = weekIdOf(weekStart)
  const boards = await Promise.all(
    DAILY_DIFFICULTIES.map((tier) =>
      redis.zRange(weeklyBoardKey(weekId, tier), 0, -1, { by: 'rank' })
    )
  )
  return {
    weekId,
    weekStart,
    weekEnd: addDays(weekStart, DAYS_PER_WEEK - 1),
    solvers: new Set(boards.flat().map((entry) => entry.member)),
  }
}

const loadWeeklySolvers = (lastDate: string): Promise<WeeklySolvers[]> => {
  const firstWeekStart = weekStartOf(WEEKLY_BOARDS_SINCE)
  const weekCount = daysBetween(firstWeekStart, weekStartOf(lastDate)) / DAYS_PER_WEEK + 1
  return Promise.all(
    Array.from({ length: weekCount }, (_, index) =>
      loadWeekSolvers(addDays(firstWeekStart, index * DAYS_PER_WEEK))
    )
  )
}

const usersFor = (activity: Activity, event: GrowthEventName): UsersByDate =>
  activity.byEvent.get(event) ?? NO_USERS

const prepareRun = async (now: Date): Promise<BaselineRun> => {
  const window = baselineWindow(now)
  const activity = await loadActivity(window.dates)
  const weeks = await loadWeeklySolvers(window.end)
  const knownSolvers = findPreWindowSolvers({
    windowStart: window.start,
    weeks,
    solversByDate: usersFor(activity, 'submit_success'),
  })
  const cohorts = assignCohorts(activity.activeByDate, knownSolvers)
  return { recordedAt: now.toISOString(), window, activity, weeks, cohorts }
}

// ── Writes ──────────────────────────────────────────────────────────────────

const writeNewFields = async (updates: readonly (readonly [string, MetricFields])[]) => {
  const pending = updates.filter(([, fields]) => Object.keys(fields).length > 0)
  await Promise.all(pending.map(([key, fields]) => redis.hSet(key, fields)))
  return pending.length
}

const countOn = (activity: Activity, event: GrowthEventName, date: string): number =>
  usersFor(activity, event).get(date)?.size ?? 0

const funnelCountsOn = (activity: Activity, date: string): FunnelCounts => ({
  app_open: countOn(activity, 'app_open', date),
  first_input: countOn(activity, 'first_input', date),
  submit_success: countOn(activity, 'submit_success', date),
  share_success: countOn(activity, 'share_success', date),
  join_success: countOn(activity, 'join_success', date),
  shop_open: countOn(activity, 'shop_open', date),
})

const dailyFieldsFor = (
  run: BaselineRun,
  date: string,
  hourly: Readonly<Record<string, string>>
): MetricFields => {
  const lookbackComplete = isLookbackComplete(date, run.window.start)
  const solvers = usersFor(run.activity, 'submit_success')
  const openers = usersFor(run.activity, 'app_open')
  return buildDailyRecord({
    counts: funnelCountsOn(run.activity, date),
    activeUsers: run.activity.activeByDate.get(date)?.size ?? 0,
    newUsers: run.cohorts.get(date)?.size ?? 0,
    wrs: lookbackComplete ? countRitualSolvers(solvers, date) : null,
    dqe: lookbackComplete ? averageDailyOpeners(openers, date) : null,
    solvesByHour: parseSolvesByHour(hourly),
    recordedAt: run.recordedAt,
  })
}

// Each date's funnel fields are written once; later runs skip recorded dates.
const writeDailyRecords = async (run: BaselineRun): Promise<number> => {
  const { dates } = run.window
  const markers = await Promise.all(
    dates.map((date) => redis.hGet(dailyMetricsKey(date), RECORDED_AT_FIELD))
  )
  const pending = dates.filter((_, index) => !markers[index])
  const hourly = await Promise.all(pending.map((date) => redis.hGetAll(hourlySolvesKey(date))))
  return writeNewFields(
    pending.map((date, index) => [
      dailyMetricsKey(date),
      dailyFieldsFor(run, date, hourly[index] ?? {}),
    ])
  )
}

const writeCohortRecords = async (run: BaselineRun) => {
  const { dates, start, end } = run.window
  const existing = await Promise.all(dates.map((date) => redis.hGetAll(cohortMetricsKey(date))))
  const updates = dates.map((date, index) => {
    const fields = pendingCohortFields({
      date,
      existing: existing[index] ?? {},
      members: run.cohorts.get(date) ?? new Set<string>(),
      activeByDate: run.activity.activeByDate,
      lastCompleteDate: end,
      historyDays: daysBetween(start, date),
    })
    return { date, fields, record: { ...existing[index], ...fields } }
  })
  const written = await writeNewFields(
    updates.map(({ date, fields }) => [cohortMetricsKey(date), fields])
  )
  return { written, records: new Map(updates.map(({ date, record }) => [date, record])) }
}

const writeCohortWeekRecords = async (
  run: BaselineRun,
  cohortRecords: ReadonlyMap<string, Readonly<MetricFields>>
): Promise<number> => {
  const { weeks } = run
  const newSolvers = newSolversByWeek(weeks)
  const existing = await Promise.all(
    weeks.map((week) => redis.hGetAll(cohortWeekMetricsKey(week.weekId)))
  )
  return writeNewFields(
    weeks.map((week, index) => {
      const current = existing[index] ?? {}
      const dailyCohorts = listDates(week.weekStart, week.weekEnd).map((date) =>
        cohortRecords.get(date)
      )
      const solverFields = pendingSolverWeekFields({
        index,
        weeks,
        newSolvers,
        existing: current,
        lastCompleteDate: run.window.end,
      })
      const fields = { ...sumCohortWeek(current, dailyCohorts), ...solverFields }
      return [cohortWeekMetricsKey(week.weekId), fields]
    })
  )
}

// ── Per-post section ────────────────────────────────────────────────────────

const requireSubredditName = (): string => {
  const { subredditName } = context
  if (!subredditName) throw new Error('subredditName is required')
  return subredditName
}

// The new-posts listing is newest first, so the scan stops at the cursor date.
const listSettlingPosts = async (
  after: string | undefined,
  through: string
): Promise<PendingPost[]> => {
  const posts: PendingPost[] = []
  const listing = reddit.getNewPosts({
    subredditName: requireSubredditName(),
    limit: POST_LISTING_LIMIT,
    pageSize: POST_LISTING_PAGE_SIZE,
  })
  for await (const post of listing) {
    const date = toISODate(post.createdAt)
    if (after !== undefined && date <= after) break
    const slot = parsePostSlot(post.title)
    if (date > through || slot === null) continue
    posts.push({ id: post.id, date, slot, hour: post.createdAt.getUTCHours() })
  }
  return posts
}

const readPostBoard = (postId: string, tier: Difficulty) =>
  redis.zRange(leaderboardKey(`${postId}:${tier}`), 0, -1, { by: 'rank' })

const summarizePost = async (post: PendingPost): Promise<PostSummary> => {
  const [easy, medium, hard] = await Promise.all([
    readPostBoard(post.id, 'easy'),
    readPostBoard(post.id, 'medium'),
    readPostBoard(post.id, 'hard'),
  ])
  const boards = summarizePostBoards({ easy, medium, hard }, SUB_FLOOR_SECONDS)
  return { id: post.id, slot: post.slot, hour: post.hour, ...boards }
}

// Oldest first: every window day in range, so days without a post are marked
// too, plus older days that had a post.
const settleDates = (
  posts: readonly PendingPost[],
  window: BaselineWindow,
  after: string | undefined,
  through: string
): string[] => {
  const windowDays = window.dates.filter(
    (date) => (after === undefined || date > after) && date <= through
  )
  return [...new Set([...posts.map((post) => post.date), ...windowDays])].sort()
}

// The budget caps board reads: days without a post are free, and the first day
// with posts always fits, so every run makes progress.
const takeWithinBudget = (
  dates: readonly string[],
  postsOn: (date: string) => readonly PendingPost[],
  maxPosts: number
): string[] => {
  const taken: string[] = []
  let spent = 0
  for (const date of dates) {
    const count = postsOn(date).length
    if (count > 0 && spent > 0 && spent + count > maxPosts) break
    taken.push(date)
    spent += count
  }
  return taken
}

const writePostSections = async (window: BaselineWindow, maxPosts: number): Promise<number> => {
  const after = (await redis.hGetAll(BASELINE_STATE_KEY))[POSTS_THROUGH_FIELD]
  const through = addDays(window.end, -POST_SETTLE_DAYS)
  if (after !== undefined && after >= through) return 0
  const posts = await listSettlingPosts(after, through)
  const postsOn = (date: string) => posts.filter((post) => post.date === date)
  const dates = takeWithinBudget(settleDates(posts, window, after, through), postsOn, maxPosts)
  for (const date of dates) {
    const summaries = await Promise.all(postsOn(date).map(summarizePost))
    await redis.hSet(dailyMetricsKey(date), buildPostSection(summaries))
    // Advance per date so a run cut short by a time limit keeps its progress.
    await redis.hSet(BASELINE_STATE_KEY, { [POSTS_THROUGH_FIELD]: date })
  }
  return dates.length
}

// ── Entry points ────────────────────────────────────────────────────────────

export const runBaselineJob = async (
  now: Date = new Date(),
  { maxPostsPerRun = DEFAULT_MAX_POSTS_PER_RUN }: BaselineRunOptions = {}
): Promise<BaselineRunSummary> => {
  const run = await prepareRun(now)
  // Expiring hash data first; the per-post boards never expire, so they go last.
  const dailyRecords = await writeDailyRecords(run)
  const cohorts = await writeCohortRecords(run)
  const weekRecords = await writeCohortWeekRecords(run, cohorts.records)
  const postDates = await writePostSections(run.window, maxPostsPerRun)
  return { dailyRecords, cohortRecords: cohorts.written, weekRecords, postDates }
}

const readRecords = async (
  dates: readonly string[],
  keyOf: (date: string) => string
): Promise<DatedFields[]> => {
  const records = await Promise.all(dates.map((date) => redis.hGetAll(keyOf(date))))
  return dates.map((date, index) => ({ date, fields: records[index] ?? {} }))
}

export const readBaselineReadout = async (now: Date = new Date()): Promise<string> => {
  const end = addDays(toISODate(now), -1)
  const dates = listDates(addDays(end, 1 - READOUT_DAYS), end)
  const [daily, cohorts] = await Promise.all([
    readRecords(dates, dailyMetricsKey),
    readRecords(dates, cohortMetricsKey),
  ])
  return formatBaselineReadout({ daily, cohorts })
}
