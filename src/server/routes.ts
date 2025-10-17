import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import {
  computeNextStreak,
  normalizeStreakFromRedis,
  serializeStreakForRedis
} from '../shared/streak'
import type { Grid, PuzzleWithGrid } from '../shared/types/puzzle'
import { validateGrid } from '../shared/validator'

const app = new Hono()

const HTTP_BAD_REQUEST = 400
const HTTP_OK = 200
const DEFAULT_GRID_SIZE = 6
const DECIMAL_RADIX = 10
const GRID_SIZE_TYPE = 6 as const
const HTTP_UNAUTHORIZED = 401

const streakKey = (id: string) => `user:${id}:streak`

const resolveUserKey = async (): Promise<string | null> => {
  if (context.userId) {
    return context.userId
  }
  const username = await reddit.getCurrentUsername()
  return username ?? null
}

app.get('/api/health', (c) => c.json({ ok: true }))

// Join subreddit
app.post('/api/join-subreddit', async (c) => {
  try {
    await reddit.subscribeToCurrentSubreddit()
  } catch (error) {
    return c.json(
      { status: 'error', message: `Failed to join subreddit. Error: ${error}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.get('/api/streak', async (c) => {
  try {
    const userIdentifier = await resolveUserKey()
    if (!userIdentifier) {
      return c.json({ error: 'user not available' }, HTTP_UNAUTHORIZED)
    }
    const raw = await redis.hGetAll(streakKey(userIdentifier))
    const streak = normalizeStreakFromRedis(raw)
    return c.json({ streak })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to load streak: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.post('/api/streak', async (c) => {
  const payload = await c.req.json<{ date: string }>().catch(() => null)
  if (!payload || typeof payload.date !== 'string') {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  try {
    const userIdentifier = await resolveUserKey()
    if (!userIdentifier) {
      return c.json({ error: 'user not available' }, HTTP_UNAUTHORIZED)
    }

    const key = streakKey(userIdentifier)
    const previous = normalizeStreakFromRedis(await redis.hGetAll(key))
    const targetDate = payload.date
    if (previous.lastPlayed === targetDate) {
      return c.json({ streak: previous })
    }

    const updated = computeNextStreak(previous, targetDate)

    await redis.hSet(key, serializeStreakForRedis(updated))

    return c.json({ streak: updated })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to update streak: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

// Get puzzle for the current post
app.get('/api/puzzle', async (c) => {
  const { postId } = context

  if (!postId) {
    return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
  }

  try {
    // Fetch puzzle from Redis using postId
    const puzzleData = await redis.hGetAll(`post:${postId}:puzzle`)

    if (!puzzleData?.id) {
      return c.json(
        { error: 'Puzzle not found for this post' },
        HTTP_BAD_REQUEST
      )
    }

    const puzzle: PuzzleWithGrid = {
      id: puzzleData.id,
      size: Number.parseInt(
        puzzleData.size || DEFAULT_GRID_SIZE.toString(),
        DECIMAL_RADIX
      ) as typeof GRID_SIZE_TYPE,
      difficulty: puzzleData.difficulty as 'easy' | 'medium' | 'hard',
      fixed: JSON.parse(puzzleData.fixed || '[]'),
      initial: JSON.parse(puzzleData.initial || '[]')
    }

    return c.json({ puzzle })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to fetch puzzle: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.post('/api/submit', async (c) => {
  const body = await c.req.json<{ id: string; grid: Grid }>().catch(() => null)
  if (!body || typeof body.id !== 'string' || !Array.isArray(body.grid)) {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const { postId } = context
  if (!postId) {
    return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
  }

  try {
    // Fetch puzzle from Redis
    const puzzleData = await redis.hGetAll(`post:${postId}:puzzle`)

    if (!puzzleData?.id) {
      return c.json(
        { error: 'Puzzle not found for this post' },
        HTTP_BAD_REQUEST
      )
    }

    const fixed = JSON.parse(puzzleData.fixed || '[]')
    const result = validateGrid(body.grid, fixed)

    if (!result.ok) {
      return c.json({ ok: false, errors: result.errors }, HTTP_OK)
    }

    // Store submission record for this post
    const key = `submission:${postId}:${body.id}`
    const exists = await redis.get(key)
    if (!exists) {
      await redis.set(key, '1')
    }

    return c.json({ ok: true })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Submission failed: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

export default app
