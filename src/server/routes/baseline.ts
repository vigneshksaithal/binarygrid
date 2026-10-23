import { context, reddit } from '@devvit/web/server'
import type { UiResponse } from '@devvit/web/shared'
import { Hono } from 'hono'
import { readBaselineReadout, readSlotShopReadout, runBaselineJob } from '../core/baseline'

const HTTP_INTERNAL_ERROR = 500
const READOUT_FAILED_MESSAGE = 'Could not load the baseline metrics. Try again later.'
const SLOT_SHOP_FAILED_MESSAGE = 'Could not load the post slot and shop numbers. Try again later.'
const MODERATORS_ONLY_MESSAGE = 'Only moderators can see these numbers.'

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

// The readout menu items are shown to moderators only (`forUserType` in devvit.json).
// Checking again here keeps the numbers from relying on the menu alone. The listing
// is filtered by username; matching the ID too means an unfiltered list grants nothing.
const isCurrentUserModerator = async (): Promise<boolean> => {
  const { subredditName, userId } = context
  if (!userId || !subredditName) return false
  const username = await reddit.getCurrentUsername()
  if (!username) return false
  const moderators = await reddit.getModerators({ subredditName, username }).all()
  return moderators.some((moderator) => moderator.id === userId)
}

const neutralToast = (text: string): UiResponse => ({ showToast: { text, appearance: 'neutral' } })

// Readouts return aggregate counts and read no request input. A failure, including
// a failed moderator check, shows a toast with no numbers instead of an error.
const moderatorReadout = async (
  readout: () => Promise<string>,
  failedMessage: string
): Promise<UiResponse> => {
  try {
    if (!(await isCurrentUserModerator())) return neutralToast(MODERATORS_ONLY_MESSAGE)
    return neutralToast(await readout())
  } catch {
    return neutralToast(failedMessage)
  }
}

baselineRoutes.post('/internal/menu/baseline-readout', async (c) =>
  c.json<UiResponse>(await moderatorReadout(readBaselineReadout, READOUT_FAILED_MESSAGE))
)

baselineRoutes.post('/internal/menu/slot-shop-readout', async (c) =>
  c.json<UiResponse>(await moderatorReadout(readSlotShopReadout, SLOT_SHOP_FAILED_MESSAGE))
)
