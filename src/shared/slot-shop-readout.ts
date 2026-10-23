import {
  addDays,
  type BaselineFunnelEvent,
  type DatedFields,
  listDates,
  type MetricFields,
  NO_RECORDS_MESSAGE,
  newestFirst,
  RECORDED_AT_FIELD,
  roundToTenth,
  sum,
} from './baseline'

// Moderator readout for two open decisions: which daily post slot to keep (task 5's
// slot setting) and how much the shop was used before coins retire (task 8). It reads
// only the aggregates the nightly baseline job stores in metrics:daily:{date}.

export type ComparedSlot = 'Morning' | 'Evening'
export type SlotSolvers = { slot: ComparedSlot; posts: number; median: number | null }
export type OpenerAverages = { days: number; shop: number; app: number }

type RecordedPost = { slot: string; solvers: number }

const COMPARED_SLOTS: readonly ComparedSlot[] = ['Morning', 'Evening']
// "The most recent 8 weeks of recorded posts": 56 days ending on the job's post cursor.
const SLOT_WINDOW_DAYS = 56
const OPENER_WINDOW_DAYS = 30
// About two weeks of daily posts; a median over fewer can't even out weekday effects
// (report §8: read whole weeks and mind sample size).
const MIN_POSTS_PER_SLOT = 14
// buildPostSection in ./baseline stores each post as post:{t3_id} = JSON.
const POST_FIELD_PREFIX = 'post:'
const SLOTS_LABEL = 'Median solvers/post'
const OPENERS_LABEL = 'Openers/day'

export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2
}

// The 56 dates ending on `postsThrough`, the newest date the job has recorded posts for.
export const slotWindowDates = (postsThrough: string): string[] =>
  listDates(addDays(postsThrough, 1 - SLOT_WINDOW_DAYS), postsThrough)

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const isRecordedPost = (value: unknown): value is RecordedPost =>
  typeof value === 'object' &&
  value !== null &&
  'slot' in value &&
  typeof value.slot === 'string' &&
  'solvers' in value &&
  typeof value.solvers === 'number' &&
  Number.isInteger(value.solvers) &&
  value.solvers >= 0

// Unreadable post fields are skipped rather than failing the whole readout.
const readRecordedPosts = (fields: Readonly<MetricFields>): RecordedPost[] =>
  Object.entries(fields)
    .filter(([field]) => field.startsWith(POST_FIELD_PREFIX))
    .map(([, value]) => parseJson(value))
    .filter(isRecordedPost)

// Posts from the single-post era (slot `single`) have no slot to compare.
export const summarizeSlots = (records: readonly DatedFields[]): SlotSolvers[] => {
  const posts = records.flatMap((record) => readRecordedPosts(record.fields))
  return COMPARED_SLOTS.map((slot) => {
    const solvers = posts.filter((post) => post.slot === slot).map((post) => post.solvers)
    return { slot, posts: solvers.length, median: median(solvers) }
  })
}

// Unique logged-in openers a day over the newest recorded days. Days that hold only a
// post section (posts backfilled from before the job's window) have no funnel counts.
export const averageOpeners = (daily: readonly DatedFields[]): OpenerAverages | null => {
  const days = newestFirst(daily)
    .filter((record) => record.fields[RECORDED_AT_FIELD] !== undefined)
    .slice(0, OPENER_WINDOW_DAYS)
  if (days.length === 0) return null
  const average = (event: BaselineFunnelEvent): number =>
    roundToTenth(sum(days.map((day) => Number(day.fields[event] ?? 0))) / days.length)
  return { days: days.length, shop: average('shop_open'), app: average('app_open') }
}

const describeSlot = (summary: SlotSolvers): string =>
  summary.median === null || summary.posts < MIN_POSTS_PER_SLOT
    ? `${summary.slot} too few posts (${summary.posts})`
    : `${summary.slot} ${summary.median} (${summary.posts} posts)`

// Names the window's last day: posts settle for a week before they are recorded, and
// the first nights of the backfill record the oldest posts first.
const describeSlots = (slots: readonly SlotSolvers[], postsThrough: string): string =>
  `${SLOTS_LABEL} to ${postsThrough}: ${slots.map(describeSlot).join(', ')}`

const describeOpeners = (openers: OpenerAverages | null): string => {
  if (openers === null) return `${OPENERS_LABEL}: no daily records yet`
  const span = openers.days === 1 ? '1 day' : `${openers.days} days`
  return `${OPENERS_LABEL}: shop ${openers.shop}, app ${openers.app} (${span})`
}

// `daily` holds metrics:daily:{date} records for the slot window and the recent days;
// `postsThrough` is the job's post cursor, undefined until it has recorded a post day.
export const formatSlotShopReadout = ({
  daily,
  postsThrough,
}: {
  daily: readonly DatedFields[]
  postsThrough: string | undefined
}): string => {
  const openers = averageOpeners(daily)
  if (postsThrough === undefined) {
    if (openers === null) return NO_RECORDS_MESSAGE
    return `${SLOTS_LABEL}: no recorded posts yet · ${describeOpeners(openers)}`
  }
  const window = new Set(slotWindowDates(postsThrough))
  const slots = summarizeSlots(daily.filter((record) => window.has(record.date)))
  return `${describeSlots(slots, postsThrough)} · ${describeOpeners(openers)}`
}
