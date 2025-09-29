import { SIZE } from '../../shared/rules'
import type {
    Difficulty,
    Grid,
    PuzzleWithGrid
} from '../../shared/types/puzzle'

/**
 * Returns a deterministic 6x6 null grid.
 */
const makeEmptyGrid = (): Grid => {
    const grid: Grid = new Array(SIZE)
    for (let r = 0; r < SIZE; r++) {
        const row = new Array(SIZE)
        for (let c = 0; c < SIZE; c++) row[c] = null
        grid[r] = row
    }
    return grid
}

/**
 * Stub generator for Phase 2: deterministic by date + difficulty, no clues yet.
 */
export const generateDailyPuzzle = (
    dateISO: string,
    difficulty: Difficulty
): PuzzleWithGrid => {
    const id = `${dateISO}:${difficulty}`
    return {
        id,
        size: 6,
        difficulty,
        fixed: [],
        initial: makeEmptyGrid()
    }
}
