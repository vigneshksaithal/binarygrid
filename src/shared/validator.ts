import {
  EXACT_ONES_PER_LINE,
  EXACT_ZEROS_PER_LINE,
  MAX_CONSECUTIVE_RUN,
  SIZE
} from './rules'
import type { Cell, FixedCell, Grid, ValidationResult } from './types/puzzle'

const TRIPLE_RUN_LENGTH = 3

/**
 * Returns true if the provided value is a valid Cell.
 */
function isValidCellValue(value: unknown): value is Cell {
  return value === 0 || value === 1 || value === null
}

/**
 * Ensures the grid has SIZE x SIZE dimensions and only valid values.
 */
function validateShapeAndDomain(grid: Grid, errors: string[]): void {
  if (!Array.isArray(grid) || grid.length !== SIZE) {
    errors.push(`Grid must have ${SIZE} rows.`)
    return
  }
  for (let r = 0; r < SIZE; r++) {
    const row = grid[r]
    if (!Array.isArray(row) || row.length !== SIZE) {
      errors.push(`Row ${r} must have ${SIZE} columns.`)
      continue
    }
    for (let c = 0; c < SIZE; c++) {
      const value = row[c]
      if (!isValidCellValue(value)) {
        errors.push(`Cell (${r},${c}) has invalid value.`)
      }
    }
  }
}

// Safe access helpers to satisfy strict typing when callers may not guarantee shape
const getRow = (grid: Grid, r: number): Cell[] => {
  const row = grid[r]
  // Fast path: return directly if row is valid (most common case)
  if (Array.isArray(row) && row.length === SIZE) {
    return row as Cell[]
  }
  // Slow path: create fallback only when needed
  return createFallbackRow(row)
}

const createFallbackRow = (row: Cell[] | undefined): Cell[] => {
  const fallback: Cell[] = new Array(SIZE)
  for (let c = 0; c < SIZE; c++) {
    fallback[c] = (row?.[c] ?? null) as Cell
  }
  return fallback
}

const getCell = (grid: Grid, r: number, c: number): Cell => {
  const v = grid[r]?.[c]
  return v === 0 || v === 1 ? v : null
}

/**
 * Returns true if the line contains a forbidden triple run (e.g., 000 or 111).
 * Nulls break runs and are ignored for the triple check.
 * Optimized to track run length incrementally instead of checking windows.
 */
export function hasTripleRun(line: Cell[]): boolean {
  let runLength = 1
  let lastValue: Cell = line[0] ?? null

  for (let i = 1; i < line.length; i++) {
    const current = line[i]
    if (current !== null && current === lastValue) {
      runLength++
      if (runLength >= TRIPLE_RUN_LENGTH) {
        return true
      }
    } else {
      runLength = 1
      lastValue = current ?? null
    }
  }
  return false
}

/**
 * Returns true if the grid is fully filled (no nulls).
 */
export function isComplete(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getCell(grid, r, c) === null) {
        return false
      }
    }
  }
  return true
}

/**
 * Validates count constraints for a line.
 */
function validateLineCounts(
  line: Cell[],
  label: string,
  errors: string[]
): boolean {
  let zeros = 0
  let ones = 0
  let nulls = 0
  for (const v of line) {
    if (v === 0) {
      zeros++
    } else if (v === 1) {
      ones++
    } else {
      nulls++
    }
  }

  if (nulls === 0) {
    if (zeros !== EXACT_ZEROS_PER_LINE || ones !== EXACT_ONES_PER_LINE) {
      errors.push(`${label} must have an equal number of 0s and 1s.`)
      return true
    }
  } else {
    if (zeros > EXACT_ZEROS_PER_LINE) {
      errors.push(`${label} has too many zeros.`)
      return true
    }
    if (ones > EXACT_ONES_PER_LINE) {
      errors.push(`${label} has too many ones.`)
      return true
    }
  }

  return false
}

/**
 * Validates a single line (row or column) for count and triple-run constraints.
 */
function validateLine(line: Cell[], label: string, errors: string[]): boolean {
  let hasError = false

  // Triple run check
  if (hasTripleRun(line)) {
    errors.push(`${label} can't have three identical numbers in a row.`)
    hasError = true
  }

  // Count constraints
  if (validateLineCounts(line, label, errors)) {
    hasError = true
  }

  return hasError
}

/**
 * Validates that fixed cells are respected by the current grid.
 */
function validateFixedCells(
  grid: Grid,
  fixed: FixedCell[],
  errors: string[]
): void {
  for (const f of fixed) {
    const { r, c, v } = f
    const cell = grid[r]?.[c]
    if (cell === undefined) {
      errors.push(`Fixed cell (${r},${c}) is out of bounds.`)
      continue
    }
    if (cell !== null && cell !== v) {
      errors.push(`Cell (${r},${c}) must equal fixed value ${v}.`)
    }
  }
}

/**
 * Validates the entire grid against all rules and fixed clues.
 */
export function validateGrid(
  grid: Grid,
  fixed: FixedCell[] = []
): ValidationResult {
  const errors: string[] = []
  const errorRows: number[] = []
  const errorColumns: number[] = []

  // Shape and domain checks
  validateShapeAndDomain(grid, errors)
  if (errors.length > 0) {
    return { ok: false, errors }
  }

  // Fixed cells respected
  validateFixedCells(grid, fixed, errors)

  // Rows
  for (let r = 0; r < SIZE; r++) {
    const hasError = validateLine(getRow(grid, r), `Row ${r}`, errors)
    if (hasError) {
      errorRows.push(r)
    }
  }

  // Columns - reuse single array to reduce allocations
  const col: Cell[] = new Array(SIZE)
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE; r++) {
      col[r] = getCell(grid, r, c)
    }
    const hasError = validateLine(col, `Column ${c}`, errors)
    if (hasError) {
      errorColumns.push(c)
    }
  }

  // Final runs sanity (MAX_CONSECUTIVE_RUN used for clarity if we extend logic)
  if (MAX_CONSECUTIVE_RUN !== 2) {
    // This code path is not expected for SIZE=6 puzzle with standard rules.
  }

  const hasErrors = errors.length > 0
  const result: ValidationResult = {
    ok: !hasErrors,
    errors
  }
  if (hasErrors) {
    result.errorLocations = { rows: errorRows, columns: errorColumns }
  }
  return result
}
