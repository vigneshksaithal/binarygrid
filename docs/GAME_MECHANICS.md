# Binary Grid — Minimal System & Mechanics

This document explains the minimal Binary Grid game's mechanics, constraints, validation, and basic API. All examples are canonical to this codebase.

## Core Concept

- **Goal**: Fill a 6×6 grid with 0s and 1s.
- **Input cycle**: tap a cell cycles null → 0 → 1 → null.
- **Given cells**: some cells are fixed and cannot be changed.
- **Win condition**: every cell is filled and all rules are satisfied. The app auto-submits.

## Rules (Hard Constraints)

Let SIZE = 6.

- **R1. No Triples**: No row or column contains any contiguous triple 000 or 111.
- **R2. Balanced Lines**: Each row and each column must contain exactly SIZE/2 zeros and SIZE/2 ones. With SIZE=6, each row and column contains exactly three 0s and three 1s.
- **R3. Uniqueness (UI guidance)**: The How-To explicitly states rows and columns should be different. Server validation accepts any grid that satisfies R1 and R2 and matches givens; uniqueness is enforced in the generator to produce valid puzzles and hinted in UI rules.
- **R4. Respect Givens**: Fixed cells provided by the puzzle cannot be changed, and submitted solutions must match them.

Server-side acceptance requires: correct shape (6×6), only 0/1 values (no nulls), givens match, and the grid conforms to R1, R2 (via `gridFollowsRules`).

## Grid Generation (Deterministic per day/difficulty)

- Size: 6×6.
- Seed: `"YYYY-MM-DD:difficulty"` (UTC date key).
- Algorithm: backtracking with partial constraints to construct a solution satisfying R1 and R2 across rows and columns. Deterministic RNG: Mulberry32 seeded by FNV-1a of the seed string.
- Givens: from the full solution, reveal a subset of cells based on difficulty-specific reveal ratios: easy 50%, medium 40%, hard 30%.

## Difficulty

- `easy`: ~50% cells given
- `medium`: ~40% cells given
- `hard`: ~30% cells given

All difficulties share the same rules; only clue density changes.

## Client Validation

- The client checks per-row and per-column status: `balanced` and `noTriples`.
- A line is `balanced` if counts of 0/1 do not exceed SIZE/2 during play, and if fully filled, they are equal.
- `noTriples` scans the line for any 3-length contiguous identical values.
- When all cells are filled and all line checks pass, the client auto-submits.

## Submission Semantics

- Submission payload: `{ grid: number[][], timeMs: number }`.
- Server acceptance:
  - shape: 6×6
  - all values are 0 or 1
  - givens match
  - `gridFollowsRules(grid)` is true (R1, R2)
- If valid: return `{ ok: true, valid: true, timeMs, dateKey }`.
- If invalid: return `{ ok: false, valid: false, message }`.

## UX Flow (High-Level)

1. App fetches puzzle for selected difficulty; shows a loading overlay.
2. User edits non-fixed cells; timer runs while unsolved.
3. When the grid is full and passes client checks, the app auto-submits.
4. On success: show a simple win message.
5. Option to replay other difficulties.

## Data Shapes (Authoritative)

PuzzleInfo
