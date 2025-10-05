/**
 * Global rules and difficulty presets for Binary Grid.
 */

export const SIZE = 6
export const EXACT_ZEROS_PER_LINE = 3
export const EXACT_ONES_PER_LINE = 3
export const MAX_CONSECUTIVE_RUN = 2 // i.e., no triples allowed

export const DIFFICULTY_CLUE_RANGES = {
  easy: { min: 16, max: 18 },
  medium: { min: 12, max: 14 },
  hard: { min: 8, max: 10 }
} as const

export type DifficultyKey = keyof typeof DIFFICULTY_CLUE_RANGES

/**
 * Returns a target clue count for the given difficulty using the midpoint of the range.
 */
export function targetCluesForDifficulty(difficulty: DifficultyKey): number {
  const { min, max } = DIFFICULTY_CLUE_RANGES[difficulty]
  return Math.round((min + max) / 2)
}
