import { context } from '@devvit/web/server'
import { Hono } from 'hono'
import {
  getDailyProgress,
  getPlayerContext,
  isGrowthEventName,
  recordGrowthEvent,
} from '../lib/growth'
import { trackDau, trackFunnelEvent, trackRetentionOnOpen, trackShare } from '../lib/viral-analytics'
import { HTTP_BAD_REQUEST, HTTP_OK, todayISO } from './utils'

const app = new Hono()

type EventBody = {
  eventName: string
}

const fireAndForget = (promise: Promise<unknown>): void => {
  promise.catch(() => {
    // Viral tracking failures must not break the critical path
  })
}

app.post('/api/events', async (c) => {
  const body = await c.req.json<EventBody>().catch(() => null)
  if (!body || typeof body.eventName !== 'string') {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }
  if (!isGrowthEventName(body.eventName)) {
    return c.json({ error: 'unknown event' }, HTTP_BAD_REQUEST)
  }

  try {
    await recordGrowthEvent(body.eventName, context.userId)

    const { userId } = context
    const date = todayISO()

    if (body.eventName === 'app_open' && userId) {
      fireAndForget(trackRetentionOnOpen(userId))
      fireAndForget(trackFunnelEvent('open', date))
      fireAndForget(trackDau(userId, date))
    }

    if (body.eventName === 'puzzle_start') {
      fireAndForget(trackFunnelEvent('start', date))
    }

    if (body.eventName === 'submit_success' && userId) {
      fireAndForget(trackFunnelEvent('complete', date))
    }

    if (body.eventName === 'share_success' && userId) {
      fireAndForget(trackFunnelEvent('share', date))
      fireAndForget(trackShare(userId, date))
    }

    return c.json({ ok: true }, HTTP_OK)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to record event: ${message}` }, HTTP_BAD_REQUEST)
  }
})

app.get('/api/daily-progress', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json(
      {
        dateISO: new Date().toISOString().slice(0, 10),
        completedDifficulties: [],
        trio: {
          completedDifficulties: [],
          completedCount: 0,
          trioComplete: false,
          perfectDay: false,
          totalSolveTimeSeconds: 0,
        },
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          freezes: 0,
          todayCompleted: false,
          repairAvailable: false,
        },
        missions: [],
      },
      HTTP_OK
    )
  }

  try {
    return c.json(await getDailyProgress(userId), HTTP_OK)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to load daily progress: ${message}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.get('/api/player-context', async (c) => {
  const { userId } = context
  const puzzleId = c.req.query('puzzleId') ?? ''
  if (!userId) {
    return c.json({ error: 'login required' }, HTTP_BAD_REQUEST)
  }
  if (!puzzleId || puzzleId.length > 120) {
    return c.json({ error: 'puzzleId is required' }, HTTP_BAD_REQUEST)
  }

  try {
    return c.json(await getPlayerContext(userId, puzzleId), HTTP_OK)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to load player context: ${message}` },
      HTTP_BAD_REQUEST
    )
  }
})

export default app
