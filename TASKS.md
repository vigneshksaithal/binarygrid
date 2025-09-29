# Binary Grid – Detailed Task Breakdown

This doc lists actionable tasks with acceptance criteria, dependencies, and estimates. Status tracked in TODOs.

## 0. Branch and Environment

- Task: Create `feature/binary-grid` branch
  - Acceptance: Branch created, install works, dev server runs
  - Cmds:

    ```bash
    git checkout -b feature/binary-grid
    pnpm install
    pnpm -w run -r build || true
    ```

## 1. Shared Types (`src/shared/types/puzzle.ts`)

- Task: Define `Cell`, `FixedCell`, `Grid`, `Difficulty`, `Puzzle`, `PuzzleWithGrid`, `Submission`, `ValidationResult`
  - Acceptance: Types compile, exported from module
  - Depends: None
  - Est: 0.5h

## 2. Rules (`src/shared/rules.ts`)

- Task: Export constants and difficulty presets
  - Acceptance: SIZE=6, counts=3, max run=2; presets easy/medium/hard
  - Est: 0.25h

## 3. Validator (`src/shared/validator.ts`)

- Tasks:
  - Implement `validateGrid(grid, fixed)`
  - Helpers: `countRow`, `countCol`, `hasTripleRun`, `isComplete`
  - Optional: `nextHints`
  - Acceptance:
    - Rejects shape/value errors
    - Enforces fixed cells
    - Enforces counts and run constraints for rows/cols
    - Partial state never exceeds counts
  - Est: 1.5h

## 4. Generator (`src/server/core/generator.ts`)

- Tasks:
  - Seeded RNG `makeSeededRng`
  - Backtracking solver respecting constraints
  - Carving with uniqueness check to target clue counts per difficulty
  - `generateDailyPuzzle(date, difficulty)` wrapper returning `{ puzzle, initial }`
  - Acceptance:
    - Deterministic by `date + difficulty`
    - Meets clue count ranges
    - Unique solution
  - Est: 3h (could vary)

## 5. Server Routes (Hono) (`src/server/routes.ts`)

- Tasks:
  - `GET /api/health`
  - `GET /api/puzzle?date&difficulty`
  - `POST /api/submit`
  - In-memory cache Map by `puzzle.id`
  - Tiny rate limit per IP/day, CORS
  - Acceptance:
    - Health 200
    - Puzzle returns deterministic content
    - Submit validates and returns ok/errors
  - Est: 1h

## 6. Client Store (`src/client/stores/game.ts`)

- Tasks:
  - State: `puzzleId`, `grid`, `fixed`, `difficulty`, `status`, `errors`
  - Actions: `loadPuzzle`, `cycleCell`, `reset`, `autosubmitWhenSolved`
  - Persistence: localStorage by `puzzleId`
  - Acceptance:
    - Reload restores current puzzle
    - Autosubmit triggers on solve
  - Est: 1.5h

## 7. Client UI Components

- `App.svelte`
  - Renders header, grid, status, toolbar; theme wrapper
- `components/Grid.svelte`
  - Renders 6×6; arrow-key navigation; focus ring
- `components/Cell.svelte`
  - Handles click/Enter/Space to cycle; respects fixed lock
- `components/Toolbar.svelte`
  - Difficulty switch, reset, theme toggle, hint (optional)
- Acceptance:
  - Full interaction loop works; screen-reader friendly labels
  - Est: 2h

## 8. Styling (Tailwind Terminal Theme)

- Tasks:
  - Dark default: `bg-black text-green-400`, borders `green-700`
  - Light variant: `bg-white text-green-700`
  - Monospace font, subtle scanlines overlay
  - Theme toggle using Tailwind dark mode class
  - Acceptance: WCAG AA contrast, clear focus styles
  - Est: 1h

## 9. Autosubmit & UX Polish

- Tasks:
  - Hook validator on each edit
  - When complete+valid → POST `/api/submit`
  - Toast/banner and lock grid
  - Acceptance: Reliable autosubmit; disable interactions after solved
  - Est: 0.75h

## 10. Tests (Vitest)

- Validator: full coverage for rules and edges
- Generator: determinism, uniqueness, clue ranges
- Routes: health, puzzle, submit ok/fail
- Client: Grid interaction smoke tests with jsdom/testing-library
- Acceptance: All tests pass in CI
- Est: 2h

## 11. CI/Lint/Format

- Tasks: scripts for lint/format/test/typecheck; optional GH Actions
- Acceptance: CI green on PR
- Est: 0.5h

## 12. README

- Tasks: overview, rules, API, dev/test, deploy notes
- Acceptance: newcomer can run dev and play
- Est: 0.5h

## Risk/Notes

- Generator uniqueness can be the longest step; if needed, ship MVP with relaxed uniqueness (flagged) and tighten soon after.
