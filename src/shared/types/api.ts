// Shared types for Binary Grid API contracts and game schema

// Cell and grid
export type CellValue = -1 | 0 | 1
export type Grid = CellValue[][]
export type Coord = { row: number; col: number }

// Puzzle
export type Puzzle = {
	id: string
	dateISO: string
	difficulty: 'easy' | 'medium' | 'hard'
	clues: Grid
}

// Submission
export type Submission = {
	puzzleId: string
	filled: Grid
	solvedAtISO: string
}

// Validation
export type ViolationType =
	| 'rowCount'
	| 'colCount'
	| 'tripleRow'
	| 'tripleCol'
	| 'clueMismatch'

export type ValidationResult = {
	valid: boolean
	violations: Array<{ type: ViolationType; at?: Coord | number }>
	solved: boolean
}

// API payloads
export type GetPuzzleResponse = { puzzle: Puzzle }
export type ValidateResponse = { result: ValidationResult }
export type SubmitResponse = { ok: boolean; alreadySubmitted?: boolean }
