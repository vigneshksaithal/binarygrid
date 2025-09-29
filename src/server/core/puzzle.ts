import { redis } from '@devvit/web/server'
import type { Grid, Puzzle } from '../../shared/types/api'

const SIZE = 6

// Simple seeded PRNG (mulberry32)
const mulberry32 = (seed: number) => {
    let t = seed >>> 0
    return () => {
        t += 0x6d2b79f5
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
}

const hashString = (s: string): number => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

const hasTriple = (arr: number[]): boolean => {
    for (let i = 0; i <= SIZE - 3; i++) {
        const a = arr[i],
            b = arr[i + 1],
            c = arr[i + 2]
        if (a === b && b === c) return true
    }
    return false
}

const countBits = (arr: number[]) => ({
    zeros: arr.filter((v) => v === 0).length,
    ones: arr.filter((v) => v === 1).length
})

const isValidPlacement = (
    grid: number[][],
    row: number,
    col: number,
    val: number
): boolean => {
    grid[row][col] = val

    // Row counts cannot exceed 3
    const { zeros: zr, ones: orr } = countBits(grid[row])
    if (zr > 3 || orr > 3) {
        grid[row][col] = -1
        return false
    }
    if (hasTriple(grid[row])) {
        grid[row][col] = -1
        return false
    }

    // Col checks
    const colVals = Array.from({ length: SIZE }, (_, r) => grid[r][col])
    const { zeros: zc, ones: oc } = countBits(colVals)
    if (zc > 3 || oc > 3) {
        grid[row][col] = -1
        return false
    }
    if (hasTriple(colVals)) {
        grid[row][col] = -1
        return false
    }

    grid[row][col] = -1
    return true
}

const solveBacktracking = (rng: () => number): number[][] => {
    const grid: number[][] = Array.from({ length: SIZE }, () =>
        Array(SIZE).fill(-1)
    )

    const order = [...Array(SIZE * SIZE).keys()]
    // mild shuffle for variety
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const tmp = order[i]
        order[i] = order[j]
        order[j] = tmp
    }

    const tryFill = (idx: number): boolean => {
        if (idx === SIZE * SIZE) return true
        const pos = order[idx]
        const r = Math.floor(pos / SIZE)
        const c = pos % SIZE

        // choose value order randomly
        const values = rng() < 0.5 ? [0, 1] : [1, 0]
        for (const v of values) {
            if (isValidPlacement(grid, r, c, v)) {
                grid[r][c] = v
                // ensure final counts equal 3 when row/col gets filled
                const rowFilled = grid[r].every((x) => x !== -1)
                const colFilled = grid.every((row) => row[c] !== -1)
                if (rowFilled) {
                    const { zeros, ones } = countBits(grid[r])
                    if (zeros !== 3 || ones !== 3) {
                        grid[r][c] = -1
                        continue
                    }
                }
                if (colFilled) {
                    const colVals = Array.from({ length: SIZE }, (_, rr) => grid[rr][c])
                    const { zeros, ones } = countBits(colVals)
                    if (zeros !== 3 || ones !== 3) {
                        grid[r][c] = -1
                        continue
                    }
                }
                if (tryFill(idx + 1)) return true
                grid[r][c] = -1
            }
        }
        return false
    }

    const ok = tryFill(0)
    if (!ok) throw new Error('solver failed to generate a valid solution')
    return grid
}

const removeCluesWithUniqueness = (
    rng: () => number,
    solution: number[][],
    targetClues: number
): Grid => {
    const grid: Grid = solution.map((row) => row.slice()) as Grid
    const positions = [...Array(SIZE * SIZE).keys()]
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const t = positions[i]
        positions[i] = positions[j]
        positions[j] = t
    }

    let cluesCount = SIZE * SIZE
    const maxAttempts = SIZE * SIZE * 3
    let attempts = 0
    while (cluesCount > targetClues && attempts < maxAttempts) {
        attempts++
        const idx = positions.pop()
        if (idx === undefined) break
        const r = Math.floor(idx / SIZE)
        const c = idx % SIZE
        const backup = grid[r][c]
        grid[r][c] = -1

        // Quick uniqueness heuristic: attempt to find an alternative value placement
        // For Binary puzzle constraints this is expensive; we use a constrained search
        let foundSecond = false
        const tryVal = backup === 0 ? 1 : 0
        // Check if tryVal can be extended without immediate contradiction
        const candidateRow = grid[r].slice()
        candidateRow[c] = tryVal
        if (
            !hasTriple(candidateRow) &&
            countBits(candidateRow).zeros <= 3 &&
            countBits(candidateRow).ones <= 3
        ) {
            const colVals = Array.from({ length: SIZE }, (_, rr) => grid[rr][c])
            colVals[r] = tryVal
            if (
                !hasTriple(colVals) &&
                countBits(colVals).zeros <= 3 &&
                countBits(colVals).ones <= 3
            ) {
                // Heuristic says maybe another solution exists; consider it ambiguous
                foundSecond = true
            }
        }

        if (foundSecond) {
            grid[r][c] = backup // revert to keep uniqueness
        } else {
            cluesCount--
        }
    }
    return grid
}

const densityForDifficulty = (
    difficulty: Puzzle['difficulty']
): [number, number] => {
    if (difficulty === 'easy') return [16, 18]
    if (difficulty === 'medium') return [12, 14]
    return [8, 10]
}

export const generatePuzzle = async (
    dateISO: string,
    difficulty: Puzzle['difficulty']
): Promise<Puzzle> => {
    const seedStr = `${dateISO}:${difficulty}`
    const seed = hashString(seedStr)
    const rng = mulberry32(seed)

    const [minC, maxC] = densityForDifficulty(difficulty)
    const target = Math.floor(minC + rng() * (maxC - minC + 1))

    const full = solveBacktracking(rng)
    const clues = removeCluesWithUniqueness(rng, full, target)

    return {
        id: `${dateISO}:${difficulty}`,
        dateISO,
        difficulty,
        clues
    }
}

export const getOrCreatePuzzle = async (
    dateISO: string,
    difficulty: Puzzle['difficulty']
): Promise<Puzzle> => {
    const key = `puzzle:${dateISO}:${difficulty}`
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as Puzzle

    const puzzle = await generatePuzzle(dateISO, difficulty)
    await redis.set(key, JSON.stringify(puzzle))
    return puzzle
}
