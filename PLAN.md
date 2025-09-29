# Binary Grid (6×6) – Implementation Plan

**Goal**: Ship a daily Binary Grid puzzle (Devvit/Reddit) with Svelte frontend, Hono backend, Tailwind terminal theme, Biome formatting, and deterministic daily generation by date + difficulty. Grid rules: each row/col has exactly three 0s and three 1s; no three identical digits consecutively; respect fixed clues; autosubmit when solved.

## 1. Foundations

- **Branch**: `feature/binary-grid`
- **Stacks**: Svelte + Tailwind (client), Hono (server), TypeScript everywhere, Biome for lint/format, Vitest + jsdom + @testing-library/svelte for tests.
- **Dirs**: `src/client`, `src/server`, `src/shared`.

## 2. Shared Contracts and Rules (`src/shared`)

1. `types/puzzle.ts`
   - `type Cell = 0 | 1 | null`
   - `type FixedCell = { r: number; c: number; v: 0 | 1 }`
   - `type Grid = Cell[][] // 6×6`
   - `type Difficulty = "easy" | "medium" | "hard"`
   - `type Puzzle = { id: string; size: 6; fixed: FixedCell[]; difficulty: Difficulty }`
   - `type PuzzleWithGrid = Puzzle & { initial: Grid }`
   - `type Submission = { id: string; grid: Grid }`
   - `type ValidationResult = { ok: boolean; errors: string[] }`
2. `rules.ts`
   - Constants: `SIZE = 6`, `ROW_ONES = 3`, `ROW_ZEROS = 3`, `MAX_RUN = 2`
   - Difficulty presets (target clue counts): easy ≈ 16–18, medium ≈ 12–14, hard ≈ 8–10

## 3. Validator (`src/shared/validator.ts`)

- Pure, fast, reusable on client and server.
- Functions:
  - `validateGrid(grid, fixed): ValidationResult`
    - Shape check 6×6 and value domain check (0|1|null)
    - Respect fixed cells
    - For each row/col:
      - If complete: exactly three 0s and three 1s
      - If partial: counts must not exceed 3 for 0 or 1
      - Reject triple runs ("000"/"111").
  - Helpers: `countRow`, `countCol`, `hasTripleRun(line)`, `isComplete(grid)`.
- Optional: `nextHints(grid)` implementing basic logical deductions.

## 4. Puzzle Generator (`src/server/core/generator.ts`)

- Strategy: backtrack to produce a full valid solution (respecting all constraints while filling), then remove cells down to target clue count while enforcing uniqueness with a bounded search.
- Seeded RNG: `makeSeededRng(seed: string)` for deterministic daily puzzles by `date + difficulty`.
- Exposed API:
  - `generateDailyPuzzle(date: string, difficulty: Difficulty): PuzzleWithGrid`
  - Internals: `solve(seed)`, `carveToClues(solution, targetClues)` with uniqueness check

## 5. Hono Server (`src/server`)

- `routes.ts`:
  - `GET /api/health` → `{ ok: true }`
  - `GET /api/puzzle?date=YYYY-MM-DD&difficulty=easy|medium|hard` → `{ puzzle, initial }`
    - Uses seeded generator; caches result in-memory by `puzzle.id`.
  - `POST /api/submit` body `{ id, grid }` → `{ ok: boolean, errors?: string[] }`
    - Valid when full grid passes `validateGrid` and matches fixed.
- `index.ts` mounts Hono app, CORS, tiny rate-limiter (IP/day), in-memory cache (upgrade to Redis later).

## 6. Client (Svelte, Tailwind) (`src/client`)

- Components
  - `App.svelte`: header (date/difficulty), loader, grid, status, toolbar.
  - `components/Grid.svelte`: 6×6 matrix render; keyboard navigation.
  - `components/Cell.svelte`: cycle states null→0→1→null; block fixed; ARIA roles.
  - `components/Toolbar.svelte`: difficulty select, reset, theme toggle, optional hint.
- Store `stores/game.ts`
  - State: `puzzleId`, `grid`, `fixed`, `difficulty`, `status`, `errors`
  - Actions: `loadPuzzle`, `cycleCell`, `reset`, `autosubmitWhenSolved`
  - Persistence: localStorage under `puzzleId`
- Interactions
  - Every edit runs partial validation; if complete and valid → autosubmit

## 7. Styling (Terminal Theme)

- Dark default: `bg-black text-green-400`, borders `green-700`, focus ring `ring-green-500/60`.
- Light: `bg-white text-green-700`, borders `green-300`.
- Monospace font + subtle CRT scanlines using a repeating linear-gradient overlay.
- Tailwind dark mode via `class` strategy; theme toggle in toolbar.

## 8. Tests (Vitest)

- `validator.test.ts`: line counts, triple runs, fixed conflicts, partial constraints
- `generator.test.ts`: determinism by seed, uniqueness, clue counts per difficulty
- `routes.test.ts`: health, get puzzle, submit ok/fail
- `Grid.svelte` smoke tests: click/cycle, fixed lock, autosubmit path (mock fetch)

## 9. CI, Lint, Format

- Scripts: `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm typecheck`
- Optional GH Action to run on PR

## 10. Milestones

1. Shared types + validator
2. Server routes with stub generator
3. Client UI + theme + cycle logic
4. Plug in generator + autosubmit
5. Tests + polish

## 11. API Contracts

- GET `/api/puzzle?date&difficulty` → `{ puzzle: Puzzle, initial: Grid }`
- POST `/api/submit` → `{ ok: boolean, errors?: string[] }`

## 12. Commands

```bash
git checkout -b feature/binary-grid
pnpm add hono zod
pnpm add -D vitest @vitest/ui @testing-library/svelte @testing-library/user-event @testing-library/jest-dom jsdom
```
