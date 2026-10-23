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

/** Stores a post's puzzle for its tier. */
export const storePostPuzzle = async (
  postId: string,
  puzzle: PuzzleWithGrid
): Promise<void> => {
  await redis.hSet(postPuzzleKey(postId, puzzle.difficulty), {
    id: puzzle.id,
    size: puzzle.size.toString(),
    difficulty: puzzle.difficulty,
    fixed: JSON.stringify(puzzle.fixed),
    initial: JSON.stringify(puzzle.initial)
  })
}

/** Reads a post's stored puzzle for a tier, or null when the post has none. */
export const readPostPuzzle = async (
  postId: string,
  difficulty: Difficulty
): Promise<PuzzleWithGrid | null> => {
  const stored = await redis.hGetAll(postPuzzleKey(postId, difficulty))
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
