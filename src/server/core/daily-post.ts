import { redis } from '@devvit/web/server'
import { toISODate } from '../../shared/baseline'
import { type DailyPostSlot, readSettings } from '../lib/settings'
import { createPost } from './post'

// Both daily tasks stay scheduled (devvit.json: 08:00 and 20:00 UTC), and the
// dailyPostSlot setting picks the one that posts (ENGAGEMENT_TASKS.md task 5).
// puzzle:daily-post:{date} holds each UTC date's scheduled post, first as a
// claim and then as its post ID, so no date gets a second scheduled post, even
// on the day a moderator switches the slot. Menu posts don't count here.

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

  try {
    const post = await createPost(now)
    await redis.set(key, post.id)
    return { status: 'posted', postId: post.id }
  } catch (error) {
    // Free the date so a later run can post. If the release fails, the claim
    // stays and the date keeps at most one post.
    await redis.del(key).catch(() => undefined)
    throw error
  }
}
