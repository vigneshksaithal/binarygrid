import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'
import { isDifficulty } from '../../shared/validator'
import { timeoutSignal } from './request-timeout'

export const PUZZLE_LOAD_TIMEOUT_MS = 10_000

/** A loaded puzzle, and whether the subreddit's first screen is on. */
export type PuzzleLoad = {
  puzzle: PuzzleWithGrid
  firstScreen: boolean
}

const isPuzzle = (value: unknown): value is PuzzleWithGrid =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'difficulty' in value &&
  isDifficulty(value.difficulty) &&
  'initial' in value &&
  Array.isArray(value.initial) &&
  'fixed' in value &&
  Array.isArray(value.fixed)

// The switch is on unless the reply says it's off, as the setting defaults to on.
const readFirstScreen = (data: object): boolean =>
  !('firstScreen' in data && data.firstScreen === false)

const readPuzzleLoad = (data: unknown): PuzzleLoad | null => {
  if (typeof data !== 'object' || data === null || !('puzzle' in data)) return null
  return isPuzzle(data.puzzle) ? { puzzle: data.puzzle, firstScreen: readFirstScreen(data) } : null
}

/**
 * Loads the post's puzzle for a tier, or, with no tier, for the one the
 * server picks for this player (Easy for new players while the first screen
 * is on). Returns null when the request throws or hangs, the server answers
 * with an error, or the reply holds no puzzle, so the grid can offer Retry
 * instead of an endless skeleton or a blank grid.
 */
export const fetchPuzzle = async (difficulty?: Difficulty): Promise<PuzzleLoad | null> => {
  const query = difficulty ? `?difficulty=${difficulty}` : ''
  try {
    const res = await fetch(`/api/puzzle${query}`, {
      signal: timeoutSignal(PUZZLE_LOAD_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return readPuzzleLoad(await res.json())
  } catch {
    return null
  }
}
