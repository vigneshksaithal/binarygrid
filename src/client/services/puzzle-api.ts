import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'
import { timeoutSignal } from './request-timeout'

export const PUZZLE_LOAD_TIMEOUT_MS = 10_000

const isPuzzle = (value: unknown): value is PuzzleWithGrid =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'initial' in value &&
  Array.isArray(value.initial) &&
  'fixed' in value &&
  Array.isArray(value.fixed)

const readPuzzle = (data: unknown): PuzzleWithGrid | null => {
  if (typeof data !== 'object' || data === null || !('puzzle' in data)) return null
  return isPuzzle(data.puzzle) ? data.puzzle : null
}

/**
 * Loads the post's puzzle for a tier. Returns null when the request throws or
 * hangs, the server answers with an error, or the reply holds no puzzle, so the
 * grid can offer Retry instead of an endless skeleton or a blank grid.
 */
export const fetchPuzzle = async (difficulty: Difficulty): Promise<PuzzleWithGrid | null> => {
  try {
    const res = await fetch(`/api/puzzle?difficulty=${difficulty}`, {
      signal: timeoutSignal(PUZZLE_LOAD_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return readPuzzle(await res.json())
  } catch {
    return null
  }
}
