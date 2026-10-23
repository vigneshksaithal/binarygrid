import { redis } from '@devvit/web/server'
import { DAILY_DIFFICULTIES } from '../../shared/growth'
import type { Difficulty, PuzzleWithGrid } from '../../shared/types/puzzle'

// Each UTC date's puzzle per tier (ENGAGEMENT_TASKS.md task 5): the date's first
// post stores it under puzzle:set:{date}:{tier}, and every later post that date
// copies it, so they all serve one puzzle under one #N. Each copy gets its own
// post-scoped ID, so boards stay per post. An entry is one JSON string, which
// makes the first write atomic. Entries never expire.

/** A puzzle as a date stores it, without an ID: each post serving it adds its own. */
export type DatePuzzle = Omit<PuzzleWithGrid, 'id'>

export type GeneratePuzzle = (difficulty: Difficulty) => DatePuzzle

const datePuzzleKey = (date: string, difficulty: Difficulty): string =>
  `puzzle:set:${date}:${difficulty}`

const toDatePuzzle = ({ size, difficulty, fixed, initial }: DatePuzzle): DatePuzzle => ({
  size,
  difficulty,
  fixed,
  initial,
})

/** A date's stored puzzle for a tier, or null while the date has none. */
export const readDatePuzzle = async (
  date: string,
  difficulty: Difficulty
): Promise<DatePuzzle | null> => {
  const stored = await redis.get(datePuzzleKey(date, difficulty))
  return stored ? toDatePuzzle(JSON.parse(stored)) : null
}

/**
 * Stores a date's puzzle for its tier unless the date has one, and returns the
 * stored puzzle: the first write wins, so posts created at once still agree.
 */
export const storeDatePuzzle = async (date: string, puzzle: DatePuzzle): Promise<DatePuzzle> => {
  const entry = toDatePuzzle(puzzle)
  const key = datePuzzleKey(date, entry.difficulty)
  if (await redis.set(key, JSON.stringify(entry), { nx: true })) return entry

  const stored = await readDatePuzzle(date, entry.difficulty)
  if (!stored) throw new Error(`No ${entry.difficulty} puzzle could be stored for ${date}`)
  return stored
}

/** The dates, among those given, that stored a puzzle for at least one tier. */
export const readDatesWithPuzzles = async (dates: readonly string[]): Promise<Set<string>> => {
  const entries = dates.flatMap((date) =>
    DAILY_DIFFICULTIES.map((difficulty) => ({ date, key: datePuzzleKey(date, difficulty) }))
  )
  if (entries.length === 0) return new Set()
  const stored = await redis.mGet(entries.map(({ key }) => key))
  return new Set(entries.filter((_, index) => stored[index]).map(({ date }) => date))
}

/**
 * The date's puzzle for every tier, easy to hard. Tiers the date lacks are
 * generated and stored, so this also prepares a future date's set.
 */
export const getOrCreatePuzzleSet = async (
  date: string,
  generate: GeneratePuzzle
): Promise<DatePuzzle[]> => {
  const puzzles: DatePuzzle[] = []
  for (const difficulty of DAILY_DIFFICULTIES) {
    const stored = await readDatePuzzle(date, difficulty)
    puzzles.push(stored ?? (await storeDatePuzzle(date, generate(difficulty))))
  }
  return puzzles
}
