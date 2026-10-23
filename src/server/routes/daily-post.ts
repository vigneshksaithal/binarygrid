import { type Context, Hono } from 'hono'
import {
  createScheduledPost,
  parseDailyPostRetry,
  retryScheduledPost,
  type ScheduledPostResult
} from '../core/daily-post'
import type { DailyPostSlot } from '../lib/settings'

const HTTP_BAD_REQUEST = 400
const HTTP_INTERNAL_ERROR = 500

export const dailyPostRoutes = new Hono()

// A failed run answers with a non-2xx status, which marks it failed in the app
// logs, and says when its retry runs (null when none was scheduled).
const respond = (c: Context, result: ScheduledPostResult) => {
  if (result.status !== 'failed') return c.json(result)
  return c.json(
    {
      status: 'error',
      message: `Failed to create daily puzzle post: ${result.message}`,
      retryAt: result.retryAt
    },
    HTTP_INTERNAL_ERROR
  )
}

// Scheduler tasks `daily-post-morning` and `daily-post-evening` (devvit.json).
// A run posts only when dailyPostSlot names its slot.
const runDailyTask = (slot: DailyPostSlot) => async (c: Context) =>
  respond(c, await createScheduledPost(slot))

dailyPostRoutes.post('/internal/schedule/daily-morning', runDailyTask('morning'))
dailyPostRoutes.post('/internal/schedule/daily-evening', runDailyTask('evening'))

// One-off scheduler task `daily-post-retry` (devvit.json), scheduled by a failed run.
dailyPostRoutes.post('/internal/schedule/daily-retry', async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  const retry = parseDailyPostRetry(body)
  if (!retry) {
    return c.json({ status: 'error', message: 'Not a daily post retry' }, HTTP_BAD_REQUEST)
  }
  return respond(c, await retryScheduledPost(retry))
})
