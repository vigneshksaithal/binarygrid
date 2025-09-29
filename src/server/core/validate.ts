import type { Grid, ValidationResult } from '../../shared/types/api'

const SIZE = 6

// Ensures an array is exactly length 6 and only contains -1, 0, 1
const isValidLine = (arr: number[]): boolean =>
    Array.isArray(arr) &&
    arr.length === SIZE &&
    arr.every((v) => v === -1 || v === 0 || v === 1)

// Check any 3-consecutive window equals and not -1
const hasTriple = (arr: number[]): boolean => {
    for (let i = 0; i <= SIZE - 3; i++) {
        const a = arr[i],
            b = arr[i + 1],
            c = arr[i + 2]
        if (a !== -1 && a === b && b === c) return true
    }
    return false
}

// Count zeros and ones in a line
const countBits = (arr: number[]): { zeros: number; ones: number } => ({
    zeros: arr.filter((v) => v === 0).length,
    ones: arr.filter((v) => v === 1).length
})

// Validate a candidate grid against clues and rules
export const validateGrid = (clues: Grid, grid: Grid): ValidationResult => {
    const violations: ValidationResult['violations'] = []

    if (
        !Array.isArray(grid) ||
        grid.length !== SIZE ||
        !Array.isArray(clues) ||
        clues.length !== SIZE
    ) {
        return {
            valid: false,
            violations: [{ type: 'rowCount', at: -1 }],
            solved: false
        }
    }

    // Clue immutability and shape validation
    for (let r = 0; r < SIZE; r++) {
        if (!isValidLine(grid[r]) || !isValidLine(clues[r])) {
            return {
                valid: false,
                violations: [{ type: 'rowCount', at: r }],
                solved: false
            }
        }
        for (let c = 0; c < SIZE; c++) {
            const clue = clues[r][c]
            const val = grid[r][c]
            if (clue !== -1 && val !== clue) {
                violations.push({ type: 'clueMismatch', at: { row: r, col: c } })
            }
        }
    }

    // Triples in rows
    for (let r = 0; r < SIZE; r++) {
        if (hasTriple(grid[r])) violations.push({ type: 'tripleRow', at: r })
    }

    // Triples in cols
    for (let c = 0; c < SIZE; c++) {
        const col = Array.from({ length: SIZE }, (_, r) => grid[r][c])
        if (hasTriple(col)) violations.push({ type: 'tripleCol', at: c })
    }

    // Row/col counts exactly 3/3 only when full
    const isFull = grid.every((row) => row.every((v) => v !== -1))
    if (isFull) {
        for (let r = 0; r < SIZE; r++) {
            const { zeros, ones } = countBits(grid[r])
            if (zeros !== 3 || ones !== 3)
                violations.push({ type: 'rowCount', at: r })
        }
        for (let c = 0; c < SIZE; c++) {
            const col = Array.from({ length: SIZE }, (_, r) => grid[r][c])
            const { zeros, ones } = countBits(col)
            if (zeros !== 3 || ones !== 3)
                violations.push({ type: 'colCount', at: c })
        }
    }

    const valid = violations.length === 0
    const solved = valid && isFull
    return { valid, violations, solved }
}
