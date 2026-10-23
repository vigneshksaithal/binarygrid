import { cache, context, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'
import { generateDailyPuzzle } from '../core/generator'
import { readPostPuzzle, storePostPuzzle } from '../core/post-puzzle'
import { getOrCreatePuzzleNumber } from '../core/puzzle-number'
import { DEFAULT_SETTINGS, readSettings } from '../lib/settings'
import {
  CACHE_TTL_ONE_DAY,
  DEFAULT_DIFFICULTY,
  HTTP_BAD_REQUEST,
  resolveDate,
  resolveDifficulty,
  todayISO
} from './utils'

const app = new Hono()

// The tier the first screen opens for players new to the game.
const NEW_PLAYER_DIFFICULTY: Difficulty = 'easy'

// The subreddit's first-screen switch. The puzzle must load even when the
// settings can't be read, so a failed read falls back to the default.
const readFirstScreen = async (): Promise<boolean> => {
  try {
    return (await readSettings()).firstScreen
  } catch {
    return DEFAULT_SETTINGS.firstScreen
  }
}

// Every saved solve stamps the streak date, so a player without one has never solved.
const hasSolvedBefore = async (userId: string): Promise<boolean> =>
  Boolean(await redis.get(`user:${userId}:streak:lastDate`))

// The tier for a load that names none: while the first screen is on, Easy for
// logged-out players and players who have never solved; Medium otherwise.
const pickDifficulty = async (
  firstScreen: boolean,
  userId: string | undefined
): Promise<Difficulty> => {
  if (!firstScreen) return DEFAULT_DIFFICULTY
  if (!userId) return NEW_PLAYER_DIFFICULTY
  return (await hasSolvedBefore(userId)) ? DEFAULT_DIFFICULTY : NEW_PLAYER_DIFFICULTY
}

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
    const { postId, userId } = context
    const requested = c.req.query('difficulty')
    const firstScreen = await readFirstScreen()
    const difficulty = requested
      ? resolveDifficulty(requested)
      : await pickDifficulty(firstScreen, userId)

    const puzzle = postId
      ? await getOrStorePostPuzzle(postId, difficulty)
      : await getDailyPuzzle(resolveDate(c.req.query('date') ?? null), difficulty)

    return c.json({ puzzle, firstScreen })
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
