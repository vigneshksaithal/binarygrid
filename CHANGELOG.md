# Changelog

## 2025-10-31

- Removed the undo control from the toolbar so only hints remain as the in-game assist.
- Deleted the undo history stack and `undoLastMove` store helper to keep game state lean.
- Reduced the timer label size by adding the `text-sm` utility so its typography matches adjacent controls.

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
