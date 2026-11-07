import { redis } from '@devvit/web/server'
import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'
import {
  DECIMAL_RADIX,
  DEFAULT_GRID_SIZE,
  GRID_SIZE_TYPE,
  resolveDifficulty
} from '../routes/utils'

// The puzzle a post serves for a tier; /api/submit validates solves against it.
const postPuzzleKey = (postId: string, difficulty: Difficulty): string =>
  `post:${postId}:puzzle:${difficulty}`

const parseStoredPuzzle = (stored: Record<string, string>): PuzzleWithGrid | null => {
  if (stored.snapshot) return JSON.parse(stored.snapshot) as PuzzleWithGrid
  if (!stored?.id) return null
  return {
    id: stored.id,
    size: Number.parseInt(
      stored.size || DEFAULT_GRID_SIZE.toString(),
      DECIMAL_RADIX
    ) as typeof GRID_SIZE_TYPE,
    difficulty: resolveDifficulty(stored.difficulty ?? null),
    fixed: JSON.parse(stored.fixed || '[]'),
    initial: JSON.parse(stored.initial || '[]')
  }
}

/** Reads both current atomic snapshots and previously saved puzzle hashes. */
export const readPostPuzzle = async (
  postId: string,
  difficulty: Difficulty
): Promise<PuzzleWithGrid | null> =>
  parseStoredPuzzle(await redis.hGetAll(postPuzzleKey(postId, difficulty)))

/** Installs one complete puzzle atomically; concurrent callers serve the winner. */
export const storePostPuzzle = async (
  postId: string,
  puzzle: PuzzleWithGrid
): Promise<PuzzleWithGrid> => {
  const key = postPuzzleKey(postId, puzzle.difficulty)
  const existing = parseStoredPuzzle(await redis.hGetAll(key))
  if (existing) return existing
  await redis.hSetNX(key, 'snapshot', JSON.stringify(puzzle))
  const winner = await readPostPuzzle(postId, puzzle.difficulty)
  if (!winner) throw new Error('Unable to store puzzle')
  return winner
}
