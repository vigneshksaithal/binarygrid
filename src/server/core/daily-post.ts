import { redis, scheduler } from '@devvit/web/server'
import { addDays, toISODate } from '../../shared/baseline'
import { isISODate, isISOTime, isPostId } from '../../shared/validator'
import { DAILY_POST_SLOTS, type DailyPostSlot, readSettings } from '../lib/settings'
import { completePost, createPostForDate, preparePuzzleSet } from './post'
import { getOrCreateDateNumber, readIndexedPost } from './puzzle-number'

// Both daily tasks stay scheduled (devvit.json: 08:00 and 20:00 UTC), and the
// dailyPostSlot setting picks the one that posts (ENGAGEMENT_TASKS.md task 5).
// puzzle:daily-post:{date} holds each UTC date's scheduled post: a claim until
// Reddit accepts the post, then its post ID. So a date never gets a second
// scheduled post, even when a moderator switches the slot that day or a run
// fails after posting. Menu posts don't count.
//
// The safety net (task 7): a failed run schedules a one-off retry for its date
// (devvit.json task `daily-post-retry`). The retry finishes a post the run left
// half done, or posts if the date has no post yet. A claim lapses after a
// lease, so one a failed run couldn't release no longer blocks its retry. Each
// run that leaves its date with a post stores the next date's puzzles ahead.

type NextDatePuzzles = 'ready' | 'failed'

export type ScheduledPostResult =
  | { status: 'posted' | 'completed'; postId: string; nextDatePuzzles: NextDatePuzzles }
  | { status: 'skipped'; reason: 'other_slot' | 'already_posted' }
  | { status: 'failed'; message: string; retryAt: string | null }

/** The data of a `daily-post-retry` job: what a failed run hands its retry. */
export type DailyPostRetry = {
  /** The UTC date to post for, even when the retry runs after midnight. */
  date: string
  /** The failed run's slot: the retry posts only while dailyPostSlot names it. */
  slot: DailyPostSlot
  /** 1 for the first retry. */
  attempt: number
  /** The post Reddit accepted before the run failed, and when the run created it. */
  post?: { id: string; createdAt: string }
}

const RETRY_TASK = 'daily-post-retry'
// Minutes from a failed run to its retry, by attempt, so retries land about
// 15 min, 1 h and 3 h after the first failure. The last schedules no other.
const RETRY_DELAYS_MINUTES = [15, 45, 120] as const
// Longer than any run and shorter than the first retry delay.
const CLAIM_LEASE_MINUTES = 10
const MS_PER_MINUTE = 60_000
const CLAIM_PREFIX = 'pending:'

const scheduledPostKey = (date: string): string => `puzzle:daily-post:${date}`

const minutesAfter = (time: Date, minutes: number): Date =>
  new Date(time.getTime() + minutes * MS_PER_MINUTE)

/** The post a date's record names, or null while it holds a claim or nothing. */
const recordedPostId = (record: string | null | undefined): string | null =>
  record && !record.startsWith(CLAIM_PREFIX) ? record : null

// Claims a date's scheduled post for one run. The claim lapses after its lease
// unless Reddit accepts the post, whose ID then replaces it for good.
const claimDate = async (date: string, now: Date): Promise<boolean> =>
  Boolean(
    await redis.set(scheduledPostKey(date), `${CLAIM_PREFIX}${now.toISOString()}`, {
      nx: true,
      expiration: minutesAfter(now, CLAIM_LEASE_MINUTES),
    })
  )

// If storing the next date's puzzles fails, its first post generates them, as before.
const prepareNextDate = async (date: string): Promise<NextDatePuzzles> => {
  try {
    await preparePuzzleSet(addDays(date, 1))
    return 'ready'
  } catch {
    return 'failed'
  }
}

const dateHasPost = async (
  status: 'posted' | 'completed',
  postId: string,
  date: string
): Promise<ScheduledPostResult> => ({
  status,
  postId,
  nextDatePuzzles: await prepareNextDate(date),
})

// Reports a failed run and schedules the next retry, unless this was the last.
const failAndRetry = async (
  next: DailyPostRetry,
  error: unknown,
  now: Date
): Promise<ScheduledPostResult> => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  const delay = RETRY_DELAYS_MINUTES[next.attempt - 1]
  if (delay === undefined) return { status: 'failed', message, retryAt: null }

  const runAt = minutesAfter(now, delay)
  try {
    await scheduler.runJob({ name: RETRY_TASK, runAt, data: next })
    return { status: 'failed', message, retryAt: runAt.toISOString() }
  } catch {
    return { status: 'failed', message, retryAt: null }
  }
}

// Posts for a date this run has claimed. A failure frees the date only when
// Reddit never got the post: once the post is up, another run would post a
// second #N, so the date keeps it and the retry learns which post to finish.
const postClaimedDate = async (next: DailyPostRetry, now: Date): Promise<ScheduledPostResult> => {
  const key = scheduledPostKey(next.date)
  const submitted: { postId?: string } = {}
  let postId: string
  try {
    const post = await createPostForDate(next.date, now, async (id) => {
      submitted.postId = id
      await redis.set(key, id)
    })
    postId = post.id
  } catch (error) {
    if (!submitted.postId) {
      // If this release fails too, the claim's lease frees the date.
      await redis.del(key).catch(() => undefined)
      return failAndRetry(next, error, now)
    }
    const post = { id: submitted.postId, createdAt: now.toISOString() }
    return failAndRetry({ ...next, post }, error, now)
  }
  return dateHasPost('posted', postId, next.date)
}

/**
 * Runs one slot's daily task: posts when dailyPostSlot names the slot and the
 * UTC date has no scheduled post yet. A failed run schedules a retry.
 */
export const createScheduledPost = async (
  slot: DailyPostSlot,
  now: Date = new Date()
): Promise<ScheduledPostResult> => {
  const firstRetry: DailyPostRetry = { date: toISODate(now), slot, attempt: 1 }
  try {
    const { dailyPostSlot } = await readSettings()
    if (dailyPostSlot !== slot) return { status: 'skipped', reason: 'other_slot' }
    if (!(await claimDate(firstRetry.date, now))) {
      return { status: 'skipped', reason: 'already_posted' }
    }
  } catch (error) {
    return failAndRetry(firstRetry, error, now)
  }
  return postClaimedDate(firstRetry, now)
}

// When a post the retry finishes was created: the failed run passed that
// along. For another run's post it is now, used only if the post has no stamp.
const createdAtOf = (retry: DailyPostRetry, postId: string, now: Date): Date =>
  retry.post?.id === postId ? new Date(retry.post.createdAt) : now

const finishDatePost = async (
  retry: DailyPostRetry,
  postId: string,
  now: Date
): Promise<ScheduledPostResult> => {
  await completePost(postId, retry.date, createdAtOf(retry, postId, now))
  return dateHasPost('completed', postId, retry.date)
}

/**
 * Runs a `daily-post-retry` job. When the date has a post, the scheduled one
 * or one made that day such as a moderator's, the retry finishes it and posts
 * nothing. Otherwise it posts for the date, once, while dailyPostSlot names
 * the failed run's slot. A failed retry schedules the next.
 */
export const retryScheduledPost = async (
  retry: DailyPostRetry,
  now: Date = new Date()
): Promise<ScheduledPostResult> => {
  const key = scheduledPostKey(retry.date)
  const next: DailyPostRetry = { ...retry, attempt: retry.attempt + 1 }
  try {
    const record = await redis.get(key)
    const postId = recordedPostId(record) ?? retry.post?.id
    if (postId) {
      // Names the post when the failed run couldn't.
      if (record !== postId) await redis.set(key, postId)
      return await finishDatePost(retry, postId, now)
    }
    // A live claim means another run is posting the date.
    if (record) return { status: 'skipped', reason: 'already_posted' }

    const { dailyPostSlot } = await readSettings()
    if (dailyPostSlot !== retry.slot) return { status: 'skipped', reason: 'other_slot' }

    // Minting the date's number here wastes none: unless the date already has
    // a post, which then becomes its scheduled post, this retry posts under it.
    const indexed = await readIndexedPost(await getOrCreateDateNumber(retry.date))
    if (indexed && (await redis.set(key, indexed.postId, { nx: true }))) {
      return await finishDatePost(retry, indexed.postId, now)
    }
    if (!(await claimDate(retry.date, now))) return { status: 'skipped', reason: 'already_posted' }
  } catch (error) {
    return failAndRetry(next, error, now)
  }
  return postClaimedDate({ date: retry.date, slot: retry.slot, attempt: next.attempt }, now)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isSlot = (value: unknown): value is DailyPostSlot =>
  DAILY_POST_SLOTS.some((slot) => slot === value)

const isAttempt = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= RETRY_DELAYS_MINUTES.length

/** Reads a `daily-post-retry` request body, or null when it isn't a retry this app schedules. */
export const parseDailyPostRetry = (body: unknown): DailyPostRetry | null => {
  const data = isRecord(body) ? body.data : undefined
  if (!isRecord(data)) return null
  const { date, slot, attempt, post } = data
  if (!isISODate(date) || !isSlot(slot) || !isAttempt(attempt)) return null
  if (post === undefined) return { date, slot, attempt }
  if (!isRecord(post) || !isPostId(post.id) || !isISOTime(post.createdAt)) return null
  return { date, slot, attempt, post: { id: post.id, createdAt: post.createdAt } }
}
