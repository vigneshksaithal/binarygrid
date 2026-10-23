import { cache, context } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'
import { generateDailyPuzzle } from '../core/generator'
import { readPostPuzzle, storePostPuzzle } from '../core/post-puzzle'
import { getOrCreatePuzzleNumber } from '../core/puzzle-number'
import {
  CACHE_TTL_ONE_DAY,
  HTTP_BAD_REQUEST,
  resolveDate,
  resolveDifficulty,
  todayISO
} from './utils'

const app = new Hono()

const getDailyPuzzle = (date: string, difficulty: Difficulty): Promise<PuzzleWithGrid> =>
  cache(async () => generateDailyPuzzle(date, difficulty), {
    key: `puzzle:cache:${date}:${difficulty}`,
    ttl: CACHE_TTL_ONE_DAY
  })

// A post without a stored puzzle (the weekly recap, or a post whose generation
// failed) stores today's puzzle under its own ID before serving it, so solves
// of it validate. Today's date, not a requested one, so no client picks it.
const getOrStorePostPuzzle = async (
  postId: string,
  difficulty: Difficulty
): Promise<PuzzleWithGrid> => {
  const stored = await readPostPuzzle(postId, difficulty)
  if (stored) return stored

  const daily = await getDailyPuzzle(todayISO(), difficulty)
  const puzzle = { ...daily, id: `${postId}:${difficulty}` }
  await storePostPuzzle(postId, puzzle)
  return puzzle
}

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
    const difficulty = resolveDifficulty(c.req.query('difficulty') ?? null)

    const puzzle = postId
      ? await getOrStorePostPuzzle(postId, difficulty)
      : await getDailyPuzzle(resolveDate(c.req.query('date') ?? null), difficulty)

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
