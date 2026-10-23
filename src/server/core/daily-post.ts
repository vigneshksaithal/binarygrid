import { redis } from '@devvit/web/server'
import { toISODate } from '../../shared/baseline'
import { type DailyPostSlot, readSettings } from '../lib/settings'
import { createPost } from './post'

// Both daily tasks stay scheduled (devvit.json: 08:00 and 20:00 UTC), and the
// dailyPostSlot setting picks the one that posts (ENGAGEMENT_TASKS.md task 5).
// puzzle:daily-post:{date} holds each UTC date's scheduled post: a claim until
// Reddit accepts the post, then its post ID. So a date never gets a second
// scheduled post, even when a moderator switches the slot that day or a run
// fails after posting. Menu posts don't count.

export type ScheduledPostResult =
  | { status: 'posted'; postId: string }
  | { status: 'skipped'; reason: 'other_slot' | 'already_posted' }

const CLAIM_PREFIX = 'pending:'

const scheduledPostKey = (date: string): string => `puzzle:daily-post:${date}`

/**
 * Runs one slot's daily task: posts when dailyPostSlot names the slot and the
 * UTC date has no scheduled post yet.
 */
export const createScheduledPost = async (
  slot: DailyPostSlot,
  now: Date = new Date()
): Promise<ScheduledPostResult> => {
  const { dailyPostSlot } = await readSettings()
  if (dailyPostSlot !== slot) return { status: 'skipped', reason: 'other_slot' }

  const key = scheduledPostKey(toISODate(now))
  const claim = `${CLAIM_PREFIX}${now.toISOString()}`
  if (!(await redis.set(key, claim, { nx: true }))) {
    return { status: 'skipped', reason: 'already_posted' }
  }

  let submitted = false
  try {
    const post = await createPost(now, async (postId) => {
      submitted = true
      await redis.set(key, postId)
    })
    return { status: 'posted', postId: post.id }
  } catch (error) {
    // Free the date only when Reddit never got the post, so a later run can
    // post. Once the post is up, the date keeps it even if storing its stamp
    // or puzzles failed: another run would post a second #N. If the release
    // fails, the claim stays and the date still keeps at most one post.
    if (!submitted) await redis.del(key).catch(() => undefined)
    throw error
  }
}
