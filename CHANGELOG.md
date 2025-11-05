# Changelog

## 2025-11-05

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
