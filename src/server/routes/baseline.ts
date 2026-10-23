import type { UiResponse } from '@devvit/web/shared'
import { Hono } from 'hono'
import { readBaselineReadout, runBaselineJob } from '../core/baseline'

const HTTP_INTERNAL_ERROR = 500
const READOUT_FAILED_MESSAGE = 'Could not load the baseline metrics. Try again later.'

export const baselineRoutes = new Hono()

// Scheduler task `baseline-nightly` (devvit.json). A non-2xx status marks the run
// as failed in the app logs; every write is skip-if-present, so the next run resumes.
baselineRoutes.post('/internal/schedule/baseline', async (c) => {
  try {
    const summary = await runBaselineJob()
    return c.json({ status: 'ok', ...summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { status: 'error', message: `Baseline job failed: ${message}` },
      HTTP_INTERNAL_ERROR
    )
  }
})

// Subreddit menu item shown to moderators only (`forUserType` in devvit.json).
// It returns aggregate counts and reads no request input.
baselineRoutes.post('/internal/menu/baseline-readout', async (c) => {
  try {
    const text = await readBaselineReadout()
    return c.json<UiResponse>({ showToast: { text, appearance: 'neutral' } })
  } catch {
    return c.json<UiResponse>({
      showToast: { text: READOUT_FAILED_MESSAGE, appearance: 'neutral' },
    })
  }
})
