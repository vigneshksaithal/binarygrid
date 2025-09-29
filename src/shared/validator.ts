import {
	EXACT_ONES_PER_LINE,
	EXACT_ZEROS_PER_LINE,
	MAX_CONSECUTIVE_RUN,
	SIZE
} from './rules'
import type { Cell, FixedCell, Grid, ValidationResult } from './types/puzzle'

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

/**
 * Counts zeros, ones, and nulls in a row.
 */
export function countRowValues(
	grid: Grid,
	r: number
): { zeros: number; ones: number; nulls: number } {
	let zeros = 0
	let ones = 0
	let nulls = 0
	for (let c = 0; c < SIZE; c++) {
		const v = grid[r][c]
		if (v === 0) zeros++
		else if (v === 1) ones++
		else nulls++
	}
	return { zeros, ones, nulls }
}

/**
 * Counts zeros, ones, and nulls in a column.
 */
export function countColValues(
	grid: Grid,
	c: number
): { zeros: number; ones: number; nulls: number } {
	let zeros = 0
	let ones = 0
	let nulls = 0
	for (let r = 0; r < SIZE; r++) {
		const v = grid[r][c]
		if (v === 0) zeros++
		else if (v === 1) ones++
		else nulls++
	}
	return { zeros, ones, nulls }
}

/**
 * Returns true if the line contains a forbidden triple run (e.g., 000 or 111).
 * Nulls break runs and are ignored for the triple check.
 */
export function hasTripleRun(line: Cell[]): boolean {
	for (let i = 0; i <= line.length - 3; i++) {
		const a = line[i]
		const b = line[i + 1]
		const c = line[i + 2]
		if (a !== null && a === b && b === c) {
			return true
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
			if (grid[r][c] === null) return false
		}
	}
	return true
}

/**
 * Validates a single line (row or column) for count and triple-run constraints.
 */
function validateLine(line: Cell[], label: string, errors: string[]): void {
	// Triple run check
	if (hasTripleRun(line)) {
		errors.push(`${label} has a forbidden triple run.`)
	}

	// Count constraints
	let zeros = 0
	let ones = 0
	let nulls = 0
	for (const v of line) {
		if (v === 0) zeros++
		else if (v === 1) ones++
		else nulls++
	}
	if (nulls === 0) {
		if (zeros !== EXACT_ZEROS_PER_LINE || ones !== EXACT_ONES_PER_LINE) {
			errors.push(
				`${label} must have exactly ${EXACT_ZEROS_PER_LINE} zeros and ${EXACT_ONES_PER_LINE} ones.`
			)
		}
	} else {
		if (zeros > EXACT_ZEROS_PER_LINE) {
			errors.push(
				`${label} has too many zeros (${zeros} > ${EXACT_ZEROS_PER_LINE}).`
			)
		}
		if (ones > EXACT_ONES_PER_LINE) {
			errors.push(
				`${label} has too many ones (${ones} > ${EXACT_ONES_PER_LINE}).`
			)
		}
	}
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

	// Shape and domain checks
	validateShapeAndDomain(grid, errors)
	if (errors.length > 0) {
		return { ok: false, errors }
	}

	// Fixed cells respected
	validateFixedCells(grid, fixed, errors)

	// Rows
	for (let r = 0; r < SIZE; r++) {
		validateLine(grid[r], `Row ${r}`, errors)
	}

	// Columns
	for (let c = 0; c < SIZE; c++) {
		const col: Cell[] = new Array(SIZE)
		for (let r = 0; r < SIZE; r++) col[r] = grid[r][c]
		validateLine(col, `Column ${c}`, errors)
	}

	// Final runs sanity (MAX_CONSECUTIVE_RUN used for clarity if we extend logic)
	if (MAX_CONSECUTIVE_RUN !== 2) {
		// This code path is not expected for SIZE=6 puzzle with standard rules.
	}

	return { ok: errors.length === 0, errors }
}
