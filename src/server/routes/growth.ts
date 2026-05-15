import { context } from '@devvit/web/server'
import { Hono } from 'hono'
import {
  getDailyProgress,
  getPlayerContext,
  isGrowthEventName,
  recordGrowthEvent,
} from '../lib/growth'
import { HTTP_BAD_REQUEST, HTTP_OK } from './utils'

const app = new Hono()

app.post('/api/events', async (c) => {
  const body = await c.req.json<{ eventName: string }>().catch(() => null)
  if (!body || typeof body.eventName !== 'string') {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }
  if (!isGrowthEventName(body.eventName)) {
    return c.json({ error: 'unknown event' }, HTTP_BAD_REQUEST)
  }

  try {
    await recordGrowthEvent(body.eventName, context.userId)
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
