import { describe, expect, it } from "vitest";
import { SIZE } from "./rules";
import { solvePuzzle } from "./solver";
import type { Cell, FixedCell, Grid } from "./types/puzzle";
import { isComplete, validateGrid } from "./validator";

const empty = (): Grid =>
	Array.from({ length: SIZE }, () =>
		Array.from({ length: SIZE }, () => null as Cell),
	);

describe("solver", () => {
	it("solves an empty grid", () => {
		const grid = empty();
		const solution = solvePuzzle(grid, []);
		expect(solution).not.toBeNull();
		if (solution) {
			expect(isComplete(solution)).toBe(true);
			expect(validateGrid(solution, []).ok).toBe(true);
		}
	});

	it("solves a grid with some fixed cells", () => {
		const grid = empty();
		grid[0][0] = 0;
		grid[0][1] = 1;
		grid[1][0] = 1;
		const fixed: FixedCell[] = [
			{ r: 0, c: 0, v: 0 },
			{ r: 0, c: 1, v: 1 },
			{ r: 1, c: 0, v: 1 },
		];
		const solution = solvePuzzle(grid, fixed);
		expect(solution).not.toBeNull();
		if (solution) {
			expect(isComplete(solution)).toBe(true);
			expect(validateGrid(solution, fixed).ok).toBe(true);
			// Verify fixed cells are preserved
			expect(solution[0][0]).toBe(0);
			expect(solution[0][1]).toBe(1);
			expect(solution[1][0]).toBe(1);
		}
	});

	it("returns null for an invalid initial grid", () => {
		const grid = empty();
		// Create an invalid initial state with too many ones
		grid[0] = [1, 1, 1, 1, null, null];
		const solution = solvePuzzle(grid, []);
		expect(solution).toBeNull();
	});

	it("returns null for an unsolvable grid", () => {
		const grid = empty();
		// Create a conflicting configuration that cannot be solved
		grid[0][0] = 0;
		grid[0][1] = 0;
		grid[0][2] = 0;
		grid[0][3] = 0; // Too many zeros in row
		const solution = solvePuzzle(grid, []);
		expect(solution).toBeNull();
	});

	it("solves a partially filled valid grid", () => {
		// Start with a known valid partial grid
		const grid: Grid = [
			[0, 0, 1, 1, null, null],
			[1, 1, 0, 0, null, null],
			[null, null, null, null, null, null],
			[null, null, null, null, null, null],
			[null, null, null, null, null, null],
			[null, null, null, null, null, null],
		];
		const fixed: FixedCell[] = [
			{ r: 0, c: 0, v: 0 },
			{ r: 0, c: 1, v: 0 },
			{ r: 0, c: 2, v: 1 },
			{ r: 0, c: 3, v: 1 },
			{ r: 1, c: 0, v: 1 },
			{ r: 1, c: 1, v: 1 },
			{ r: 1, c: 2, v: 0 },
			{ r: 1, c: 3, v: 0 },
		];
		const solution = solvePuzzle(grid, fixed);
		expect(solution).not.toBeNull();
		if (solution) {
			expect(isComplete(solution)).toBe(true);
			expect(validateGrid(solution, fixed).ok).toBe(true);
		}
	});
});
