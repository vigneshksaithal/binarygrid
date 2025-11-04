/**
 * Shared type definitions for the Binary Grid puzzle.
 */

export type Cell = 0 | 1 | null

export type FixedCell = {
  r: number
  c: number
  v: 0 | 1
}

export type Grid = Cell[][]

export type Difficulty = 'easy' | 'medium' | 'hard'

export type Puzzle = {
  id: string
  size: 6
  fixed: FixedCell[]
  difficulty: Difficulty
}

export type PuzzleWithGrid = Puzzle & {
  initial: Grid
}

export type ValidationResult = {
  ok: boolean
  errors: string[]
  errorLocations?: {
    rows: number[]
    columns: number[]
  }
}
