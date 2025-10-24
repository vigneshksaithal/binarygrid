import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Grid, PuzzleWithGrid } from '../shared/types/puzzle'
import { validateGrid } from '../shared/validator'

const app = new Hono()

const HTTP_BAD_REQUEST = 400
const HTTP_OK = 200
const DEFAULT_GRID_SIZE = 6
const DECIMAL_RADIX = 10
const GRID_SIZE_TYPE = 6 as const
const HTTP_UNAUTHORIZED = 401

const puzzleProgressKey = (userId: string, puzzleId: string) =>
  `user:${userId}:puzzle:${puzzleId}`

const resolveUserKey = async (): Promise<string | null> =>
  context.userId ?? null

const isValidCellValue = (value: unknown): value is 0 | 1 | null =>
  value === 0 || value === 1 || value === null

const isValidGrid = (grid: unknown): grid is Grid =>
  Array.isArray(grid) &&
  grid.length === DEFAULT_GRID_SIZE &&
  grid.every(
    (row) =>
      Array.isArray(row) &&
      row.length === DEFAULT_GRID_SIZE &&
      row.every((cell) => isValidCellValue(cell))
  )

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

    const userIdentifier = await resolveUserKey()
    let progress: Grid | null = null

    if (userIdentifier) {
      const stored = await redis.get(puzzleProgressKey(userIdentifier, puzzle.id))
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown
          if (isValidGrid(parsed)) {
            progress = parsed
          }
        } catch {
          progress = null
        }
      }
    }

    return c.json({ puzzle, progress })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to fetch puzzle: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.post('/api/puzzle/progress', async (c) => {
  const payload = await c
    .req
    .json<{ id: string; grid: Grid }>()
    .catch(() => null)

  if (
    !payload ||
    typeof payload.id !== 'string' ||
    !isValidGrid(payload.grid)
  ) {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const userIdentifier = await resolveUserKey()
  if (!userIdentifier) {
    return c.json({ error: 'user not available' }, HTTP_UNAUTHORIZED)
  }

  await redis.set(
    puzzleProgressKey(userIdentifier, payload.id),
    JSON.stringify(payload.grid)
  )

  return c.json({ ok: true })
})

app.delete('/api/puzzle/progress', async (c) => {
  const id = c.req.query('id')

  if (!id) {
    return c.json({ error: 'id is required' }, HTTP_BAD_REQUEST)
  }

  const userIdentifier = await resolveUserKey()

  if (!userIdentifier) {
    return c.json({ error: 'user not available' }, HTTP_UNAUTHORIZED)
  }

  await redis.del(puzzleProgressKey(userIdentifier, id))

  return c.json({ ok: true })
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
