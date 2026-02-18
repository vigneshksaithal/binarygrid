import { cache, context, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { PuzzleWithGrid } from '../../shared/types/puzzle'
import { generateDailyPuzzle } from '../core/generator'
import { getOrCreatePuzzleNumber } from '../core/puzzle-number'
import {
  CACHE_TTL_ONE_DAY,
  DECIMAL_RADIX,
  DEFAULT_GRID_SIZE,
  GRID_SIZE_TYPE,
  HTTP_BAD_REQUEST,
  resolveDate,
  resolveDifficulty,
  todayISO
} from './utils'

const app = new Hono()

app.get('/api/puzzle-number', async (c) => {
  const { postId } = context
  if (!postId) {
    return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
  }

  try {
    const dateISO = todayISO()
    const dayNumber = await getOrCreatePuzzleNumber(postId, dateISO)
    return c.json({ dayNumber })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to get puzzle number: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.get('/api/puzzle', async (c) => {
  try {
    const { postId } = context
    const requestedDifficulty = resolveDifficulty(
      c.req.query('difficulty') ?? null
    )
    let puzzle: PuzzleWithGrid | null = null

    if (postId) {
      const puzzleData = await redis.hGetAll(
        `post:${postId}:puzzle:${requestedDifficulty}`
      )

      if (puzzleData?.id) {
        puzzle = {
          id: puzzleData.id,
          size: Number.parseInt(
            puzzleData.size || DEFAULT_GRID_SIZE.toString(),
            DECIMAL_RADIX
          ) as typeof GRID_SIZE_TYPE,
          difficulty: resolveDifficulty(puzzleData.difficulty ?? null),
          fixed: JSON.parse(puzzleData.fixed || '[]'),
          initial: JSON.parse(puzzleData.initial || '[]')
        }
      }
    }

    if (!puzzle) {
      const date = resolveDate(c.req.query('date') ?? null)
      const difficulty = requestedDifficulty
      puzzle = await cache(
        async () => generateDailyPuzzle(date, difficulty),
        {
          key: `puzzle:cache:${date}:${difficulty}`,
          ttl: CACHE_TTL_ONE_DAY
        }
      )
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

export default app
