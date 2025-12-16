# Changelog

## 2025-12-16

### Bug Fixes

- **game.ts (client)**:
  - Fixed hint cooldown not resetting when undoing moves. The `undo()` function now calls `resetHintCooldown()` to clear the cooldown timer and re-enable the hint button, maintaining consistency with how other side effects (error timers) are reverted.
  - Fixed `useHint` not populating `errorCells` when a hint creates a validation error. The function now uses the same delayed error display mechanism as `cycleCell`, calling `findErrorCells()` to identify problematic cells and displaying visual X highlighting after a 1-second delay. This ensures users receive consistent visual feedback when hints create invalid grid states (e.g., when combining a correct hint value with existing user-entered values creates three consecutive identical values or exceeds the count limit).

## 2025-11-25

### Performance Optimizations

- **validator.ts**: 
  - Optimized `hasTripleRun` function to use incremental run tracking instead of window-based iteration, reducing time complexity.
  - Split `getRow` into fast path (direct return) and slow path (fallback creation) to avoid unnecessary array allocations.
  - Reused column array in `validateGrid` to reduce memory allocations during validation loops.

- **solver.ts**:
  - Replaced full grid validation in `solveFrom` with lightweight constraint checking (`canPlaceValue`).
  - Added localized triple-run detection (`wouldCreateTripleRun`) that only checks the affected window instead of the entire line.
  - Only performs full `validateGrid` when the grid is complete, significantly reducing validation overhead during backtracking.

- **generator.ts**:
  - Replaced `hasTripleRunAfterPlace` with non-mutating `wouldCreateTripleRunAt` that only checks affected positions.
  - Added reusable column array (`reusableCol`) to eliminate repeated allocations in `canPlace`.
  - Reduced `ensureRow` calls by caching row references in tight loops (`tryFill`, `dfs`, `carveToClueTarget`).

- **game.ts (client)**:
  - Added `fixedSet` (Set<string>) to `GameState` for O(1) fixed cell lookups instead of O(n) array scans.
  - Updated `cycleCell` to use the optimized Set-based lookup.

- **Grid.svelte (client)**:
  - Pre-computed `errorRowSet` and `errorColSet` using Svelte's `$derived` to avoid O(n) `.includes()` calls on every cell render.
  - Changed fixed cell check to use `fixedSet.has()` instead of `.some()` for O(1) lookups.

### Tests

- Added comprehensive tests for `hasTripleRun` function covering edge cases (start, middle, end runs; null breaks; empty lines).
- Added new test file `solver.test.ts` with tests for the puzzle solver including empty grids, fixed cells, invalid grids, and unsolvable configurations.

## 2025-11-12

- Added a custom play overlay that appears on initial app load with a large, bouncing "PLAY" button and blurred background.
- Created `PlayOverlay.svelte` component with a custom large button (not using Modal component) featuring Tailwind green colors and smooth bounce animation.
- Added blurred background overlay using Tailwind's `backdrop-blur-md` utility with semi-transparent backgrounds for both light and dark modes.
- Implemented Tailwind's built-in `animate-bounce` animation for the play button instead of custom CSS keyframes.
- Styled the play button with Tailwind green colors (`bg-green-500`/`bg-green-600`) with proper dark mode support and hover effects.
- Added shadow effects with green glow (`shadow-green-500/50`) for visual depth.
- Extended the UI store (`src/client/stores/ui.ts`) with `showPlayOverlay`, `openPlayOverlay()`, and `closePlayOverlay()` functions following existing modal state management patterns.
- Integrated the play overlay into `App.svelte` to display on mount, with the play button triggering overlay dismissal and timer start when clicked.
- Standardized all green colors across the app to use Tailwind's `green-500`/`green-600` color scheme for consistency with the PlayOverlay button.
- Updated Button component default variant to use `bg-green-500 dark:bg-green-600` with proper text contrast for both light and dark modes.
- Updated Cell component fixed cells to use `bg-green-500 dark:bg-green-600` with explicit text colors (`text-neutral-900 dark:text-neutral-100`) for improved contrast and readability.
- Updated Cell component hover states to use `hover:bg-green-500/10 dark:hover:bg-green-600/10` and focus rings to use `focus:ring-green-500`.
- Updated Grid component to use Tailwind green colors (`text-green-600 dark:text-green-500`) for grid text, solved status, and loading states.
- Updated SuccessModal component to use `text-green-500 dark:text-green-400` for all green text elements.
- Updated LeaderboardModal component to use Tailwind green colors (`green-500`/`green-600`) for borders, backgrounds, text, and loading spinners with proper dark mode support.

## 2025-11-06

- Added a `daily-post` cron entry (`0 14 * * *`) in `devvit.json` so Devvit automatically calls `/internal/schedule/daily` right at 9:00 AM US Eastern (14:00 UTC) each day.
- Simplified `/internal/schedule/daily` to just call `createPost('easy')`, letting the scheduler handle all timing.

## 2025-11-05

- Tightened modal responsiveness so dialogs respect viewport bounds, adding dynamic sizing and scroll containment to the shared `Modal` wrapper.
- Streamlined the leaderboard modal layout with simpler markup, accessible description text, and a scrollable results pane that keeps pagination and actions visible.
- Added Redis-backed leaderboard tracking: `/api/submit` now records solve times and exposes standings through the new `/api/leaderboard` endpoint.
- Introduced shared leaderboard types plus client stores and a modal UI so players can browse top solvers, paginate results, and see their own rank.
- Extended the button component with a `secondary` variant and wired the success modal to jump straight into the leaderboard.
- Documented the leaderboard workflow in `AGENTS.md` and refreshed the app header controls to surface the new modal entry point.

## 2025-11-01

- Integrated `HowToPlayModal` and `SuccessModal` directly into `App.svelte` so modals are rendered at the app root level.
- Replaced the `Toolbar` component with a standalone `Button` component in the header for a cleaner, more focused UI.
- Updated the header layout from `justify-center` to `justify-between` to accommodate the new button placement alongside the timer.
- Deleted the `Toolbar.svelte` component after migrating its functionality to individual buttons and modal components.

## 2025-10-31

- Removed the hint control from `Toolbar.svelte`, leaving the modal launcher as the sole quick action in the header.
- Deleted hint-related state, helpers, and props across the game store and grid cells so gameplay no longer surfaces hint highlights.
- Removed the undo control from the toolbar so only hints remain as the in-game assist.
- Deleted the undo history stack and `undoLastMove` store helper to keep game state lean.
- Reduced the timer label size by adding the `text-sm` utility so its typography matches adjacent controls.
- Consolidated the color tokens and utility classes into `src/client/app.css` so palette updates live in a single stylesheet.
- Deleted the redundant `src/client/colors.css` import path to simplify asset management.

## 2025-10-30

- Removed the toolbar reset control so puzzle retries rely on existing hint and undo pathways.
- Pruned the unused `resetPuzzle` store helper after removing the toolbar control.

## 2025-10-26

- Replaced the bespoke success and how-to overlays with a reusable modal wrapper so future dialogs share layout and accessibility defaults.
- Simplified celebrations by firing a canvas-confetti burst directly from the success modal and removing the standalone `Confetti` overlay.

## 2025-10-24

- Simplified puzzle progress user resolution to rely on `context.userId` instead of fetching usernames.
- Removed unused username lookup in `/api/init`, simplifying the init payload.
- Removed the legacy light/dark theme toggle, deleted `/api/theme`, and reverted the client to the default dark presentation.

## 2025-10-23

- Added Redis-backed puzzle progress endpoints and migrated the client to persist grids remotely instead of local storage, fixing mobile app loads.
- Synced theme preferences via `/api/theme` so user settings travel between web and Reddit mobile.
- Hardened user detection fallback so Reddit mobile clients without identity access still receive puzzles.
- Removed the streak tracking feature from client and server code to streamline gameplay and simplify persistence requirements.
