# Binary Grid – Devvit/Reddit App Implementation Plan

## Overview

Binary Grid is a 6×6 logic puzzle for Devvit/Reddit where each tap cycles a cell through empty → 0 → 1, while fixed clue cells are immutable. Win conditions:

- Exactly three 0s and three 1s per row and per column
- No sequence of three identical numbers consecutively in any row or column
- All clues must be respected

Daily puzzles are generated per difficulty (clue density), and once solved, the solution is auto-submitted. Tech stack: Svelte (frontend), Tailwind (styling), Hono (backend), Biome (format/lint). Hacker terminal theme: dark (black + green) by default, light mode (white + green).

### Constraints

- Serverless node (Devvit): use fetch, no fs/http/https/net, no websockets/streaming
- Redis available via `@devvit/web/server`
- Assume TS, Vite, Tailwind, Biome configured and working

### Testing stack

- Runner/env: Vitest + jsdom (client) and node (server)
- Svelte component testing: `@testing-library/svelte`, `@testing-library/user-event`, `@testing-library/jest-dom`
- Keep it lean; add MSW/Playwright only if needed later

## Phase 1: Shared types and schema

- Add `src/shared/types/api.ts`:
  - Cell and grid
    - `type CellValue = -1 | 0 | 1` (empty = -1)
    - `type Grid = CellValue[][]` (6×6)
    - `type Coord = { row: number, col: number }`
  - Puzzle
    - `type Puzzle = { id: string, dateISO: string, difficulty: 'easy' | 'medium' | 'hard', clues: Grid }`
  - Submission
    - `type Submission = { puzzleId: string, filled: Grid, solvedAtISO: string }`
  - Validation
    - `type ViolationType = 'rowCount' | 'colCount' | 'tripleRow' | 'tripleCol' | 'clueMismatch'`
    - `type ValidationResult = { valid: boolean, violations: Array<{ type: ViolationType, at?: Coord | number }>, solved: boolean }`
  - API payloads
    - `type GetPuzzleResponse = { puzzle: Puzzle }`
    - `type ValidateResponse = { result: ValidationResult }`
    - `type SubmitResponse = { ok: boolean, alreadySubmitted?: boolean }`

## Phase 2: Backend (Hono in `src/server`)

- Routes
  - `GET /api/puzzle?date=YYYY-MM-DD&difficulty=easy|medium|hard` → `{ puzzle }`
  - `POST /api/validate` body `{ puzzleId, filled }` → `{ result }`
  - `POST /api/submit` body `Submission` → `{ ok, alreadySubmitted? }`
- Daily puzzle generation
  - Seeded RNG by `(date, difficulty)` for deterministic results
  - Clue density by difficulty:
    - easy: 16–18
    - medium: 12–14
    - hard: 8–10
  - Pipeline
    - Generate valid full 6×6 solution via backtracking with pruning (counts ≤ 3, no 3-in-a-row)
    - Remove cells to match clue target while preserving unique solvability (check for multiple solutions; revert when ambiguous)
    - Cache in Redis `puzzle:{date}:{difficulty}`
- Validation service
  - Check clue immutability (differences → `clueMismatch`)
  - Row/col counts equal 3/3 only when grid is full; during play allow partials
  - No 3 consecutive identical numbers in any row/column
  - `solved` when no `-1` remains and all rules pass
- Submission
  - Idempotent key `submission:{puzzleId}:{playerId}`; first write stores timestamp, later calls return `alreadySubmitted`
  - `playerId` from `X-Player-Id` header (webview stores UUID in localStorage)
- Redis
  - Use `redis` from `@devvit/web/server`, JSON serialize values

## Phase 3: Frontend (Svelte in `src/client`)

- State
  - `puzzle` (id, date, difficulty, clues)
  - `grid` (mutable, from clues with `-1` in empty cells)
  - `violations`, `isSolved`
  - `playerId` in `localStorage` (UUID)
  - `theme` (dark default, light toggle)
- Components
  - `TopBar.svelte`: date picker (today default), difficulty select, theme toggle
  - `Grid.svelte`: 6×6 grid display; clues locked; click/tap cycles; keyboard nav (arrows/WASD, 0/1/space)
  - `StatusBar.svelte`: live rule feedback; counts per row/col; concise violation badges
  - `Actions.svelte`: reset, undo/redo, share
- Flow
  - On load: ensure `playerId` → fetch puzzle → init `grid` (restore saved state if valid) → validate on each change → auto-submit when solved
- Persistence
  - Save `grid` in `localStorage` per `puzzleId`; verify against clues on restore

## Phase 4: Styling (Tailwind terminal theme)

- Dark mode (default): `bg-neutral-950 text-green-400 font-mono`; borders `border-green-800/50`
- Light mode: `bg-white text-green-600 font-mono`
- Grid cells
  - Base: `w-12 h-12 flex items-center justify-center border select-none`
  - Empty: dark `text-green-800/40`, light `text-emerald-300/50`
  - Clue: dark `bg-green-950/40 text-green-300`, light `bg-emerald-50 text-emerald-700`; `cursor-not-allowed`
  - Hover/focus: glow with `ring-emerald-400/70`
  - Violations: `ring-2 ring-red-500/70 text-red-400`
- Terminal vibe
  - `font-mono`, optional subtle scanlines on wrapper, blinking cursor accent via `::after`

## Phase 5: Client game logic

- Cell cycling: if not clue, `-1 → 0 → 1 → -1`
- Immediate validation (UX):
  - Highlight 3-in-a-row violations
  - Show per-row/col counts
  - Debounce network validate 150ms; compute `solved`
- Auto-submit on solved; disable inputs; success banner and share CTA

## Phase 6: Generation details

- Backtracking solver
  - Fill row-major; prune when row/col counts exceed 3 or a 3-window is equal
- Clue removal with uniqueness
  - Remove cells until target; after each, attempt to find a second solution; revert if ambiguous; timebox and retry generation
- Seeding
  - Seed = hash of `dateISO + ':' + difficulty` fed into simple PRNG (e.g., mulberry32/xorshift32)

## Phase 7: Identity and headers

- On first load, create `playerId` and store locally
- Send `X-Player-Id` header on validate/submit for idempotent submissions
- Later: replace with signed user context when available

## Phase 8: Security and integrity

- Backend re-validates; don’t trust client
- Rate-limit `submit` per `playerId+puzzleId` (short TTL) and idempotent key
- Reject non 6×6 grids; keep payloads small

## Phase 9: Metrics and logging

- Track generation time, uniqueness attempts, failures via Redis counters
- Track solves per date/difficulty; optional leaderboards later

## Phase 10: Testing

- Packages
  - `vitest`, `jsdom`, `@testing-library/svelte`, `@testing-library/user-event`, `@testing-library/jest-dom`
- Config
  - Client config: `test.environment = 'jsdom'`, `globals = true`, `setupFiles = ['./test/setup.ts']`
  - Server config: `test.environment = 'node'`, `globals = true`
- Scripts
  - `test` → `vitest`
- Unit tests: generator, validator, triple-check, count-check
- Deterministic seeding test
- Component tests: `Grid`, `TopBar`, `StatusBar`, `Actions`
- Integration tests: Hono routes (`/api/puzzle`, `/api/validate`, `/api/submit`) with in-process `app.request`
- Keep E2E optional initially; add Playwright later if needed

## Phase 11: Future enhancements

- Hints for forced moves
- Shareable result string (Wordle-style)
- Leaderboards per subreddit via Devvit blocks

## API contracts

- GET `/api/puzzle?date=YYYY-MM-DD&difficulty=easy|medium|hard` → `{ puzzle }`
- POST `/api/validate` body `{ puzzleId, filled }` → `{ result }`
- POST `/api/submit` headers `X-Player-Id` body `{ puzzleId, filled, solvedAtISO }` → `{ ok, alreadySubmitted? }`

## Redis keys

- `puzzle:{date}:{difficulty}`
- `submission:{puzzleId}:{playerId}`
- `metrics:puzzle:{date}:{difficulty}:{field}`

## Svelte wiring notes

- `App.svelte` composes `TopBar`, `Grid`, `StatusBar`, `Actions`; holds theme and derived stores
- `Grid.svelte` props: `clues`, `grid`, `violations`; events: `cellClick(row,col)`; keyboard nav

## Minimal client-side helpers

```javascript
// triple check for 1D array length 6 with -1 as empty
const hasTriple = (arr) => {
  for (let i = 0; i <= 3; i++) {
    const a = arr[i], b = arr[i + 1], c = arr[i + 2]
    if (a !== -1 && a === b && b === c) return true
  }
  return false
}

// count bits in a row/column
const countBits = (arr) => ({
  zeros: arr.filter(v => v === 0).length,
  ones: arr.filter(v => v === 1).length
})
```

## Branching and setup commands

```bash
git checkout -b feat/binary-grid-core
```

```bash
brew install pnpm
pnpm install
```

```bash
pnpm add hono @types/node
```

```bash
pnpm add -D vitest jsdom @testing-library/svelte @testing-library/user-event @testing-library/jest-dom
```

```bash
touch src/shared/types/api.ts src/server/core/puzzle.ts src/server/core/validate.ts src/server/routes.ts src/client/lib/stores.ts
```

```bash
pnpm dev
```

## Implementation order

1. Shared types in `src/shared/types/api.ts`
2. Validation module in `src/server/core/validate.ts`
3. Generator and seeding in `src/server/core/puzzle.ts`
4. Hono routes in `src/server/routes.ts` and wire from `src/server/index.ts`
5. Client stores and fetch helpers `src/client/lib/stores.ts`
6. Svelte components (`TopBar.svelte`, `Grid.svelte`, `StatusBar.svelte`, `Actions.svelte`)
7. Tailwind styles in `src/client/app.css` (dark default, light override)
8. Auto-validate and auto-submit; persist `playerId` and grid
9. Tests for generator and validator
10. Polish: keyboard nav, animations, share
