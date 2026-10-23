import { type Context, Hono } from 'hono'
import { createScheduledPost } from '../core/daily-post'
import type { DailyPostSlot } from '../lib/settings'

const HTTP_INTERNAL_ERROR = 500

export const dailyPostRoutes = new Hono()

// Scheduler tasks `daily-post-morning` and `daily-post-evening` (devvit.json).
// A run posts only when dailyPostSlot names its slot. A non-2xx status marks a
// failed run in the app logs.
const runDailyTask = (slot: DailyPostSlot) => async (c: Context) => {
  try {
    return c.json(await createScheduledPost(slot))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { status: 'error', message: `Failed to create daily puzzle post: ${message}` },
      HTTP_INTERNAL_ERROR
    )
  }
}

dailyPostRoutes.post('/internal/schedule/daily-morning', runDailyTask('morning'))
dailyPostRoutes.post('/internal/schedule/daily-evening', runDailyTask('evening'))
