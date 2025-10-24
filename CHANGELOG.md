# Changelog

## 2025-10-24

- Removed the legacy light/dark theme toggle, deleted `/api/theme`, and reverted the client to the default dark presentation.

## 2025-10-23

- Added Redis-backed puzzle progress endpoints and migrated the client to persist grids remotely instead of local storage, fixing mobile app loads.
- Synced theme preferences via `/api/theme` so user settings travel between web and Reddit mobile.
- Hardened user detection fallback so Reddit mobile clients without identity access still receive puzzles.
- Removed the streak tracking feature from client and server code to streamline gameplay and simplify persistence requirements.
