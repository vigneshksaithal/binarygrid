# Changelog

## 2026-07-02

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: ^0.13.3 → ^0.13.6
- `@devvit/test`: ^0.13.3 → ^0.13.6
- `@devvit/web`: 0.13.3 → 0.13.6
- `@hono/node-server`: ^2.0.4 → ^2.0.8
- `@lucide/svelte`: ^1.18.0 → ^1.23.0
- `@tailwindcss/vite`: ^4.3.1 → ^4.3.2
- `@types/node`: ^25.9.3 → ^26.1.0
- `devvit`: 0.13.3 → 0.13.6
- `hono`: ^4.12.25 → ^4.12.27
- `svelte`: ^5.56.3 → ^5.56.4
- `svelte-check`: ^4.6.0 → ^4.7.1
- `tailwindcss`: ^4.3.1 → ^4.3.2
- `vite`: 8.0.16 → 8.1.3
- `vitest`: ^4.1.8 → ^4.1.9

---

## 2026-06-13

### Remove the dead "recent solvers" social-presence row

Code review found the recent-solvers avatar row never populated: `recordSolve` was only wired to the `/api/events` `submit_success` handler, but the client never POSTs that event (real solves go through `/api/submit`, which only records a growth-event counter). With nothing ever writing `social:solvers:*`, the row was permanently empty. Since the rest of social presence (challenge, solved-today, solving-now) was already removed, this dead remnant and its unused APIs are now removed too.

- **Client**:
  - Deleted `src/client/components/SocialPresence.svelte` and `src/client/components/RecentAvatars.svelte`.
  - Deleted `src/client/stores/social.ts` (presence polling).
  - `src/client/App.svelte`: removed the `SocialPresence` import, the social-presence block, and the now-unused `postId` derived value.
- **Server**:
  - Deleted `src/server/routes/social.ts` (`GET /api/social/presence`, `GET /api/social/recent-solvers`) and `src/server/lib/social.ts` (`recordSolve`, `getRecentSolvers`, `getSocialProof`).
  - `src/server/routes/index.ts`: removed the `socialRoutes` import and registration.
  - `src/server/routes/growth.ts`: removed the dead `recordSolve` call (and import) from the `submit_success` branch and trimmed the now-unused `puzzleId`/`solveTime` fields from `EventBody`. Funnel tracking is unchanged.
- **Shared**:
  - `src/shared/viral-types.ts`: removed the now-unused `RecentSolver` and `SocialProofData` types.
- **Note**: this completes removal of the social-presence surface. `submit_success` is still recorded as a growth-funnel event in `src/server/routes/submit.ts`. Orphaned `social:solvers:*` ZSETs (if any) are inert; they carry no TTL but are never read.
- **Verified**: `bun run build` ✅, `bun run test` ✅ (86/86), `bunx biome check` clean, `tsc` no new errors (pre-existing `game.ts` errors unrelated).

---

## 2026-06-13

### Remove the "solving now" active-players feature

Removed the active-player ("X solving now") count end-to-end, including the heartbeat machinery that backed it. Recent-solver avatars and the leaderboard are unaffected.

- **Client**:
  - `src/client/components/SocialPresence.svelte`: removed the `Users` icon, the active-player count block, the `activePlayers`/`activeLabel` derived values, and the `sendHeartbeat` call. The component now renders only recent-solver avatars (with a simplified loading skeleton).
  - `src/client/stores/social.ts`: removed the `sendHeartbeat` function (the `/api/social/heartbeat` POST). Presence polling for recent solvers is retained.
- **Server**:
  - `src/server/routes/social.ts`: removed the `POST /api/social/heartbeat` route and the `recordHeartbeat` import.
  - `src/server/lib/social.ts`: removed `recordHeartbeat`, `getActivePlayers`, the `resolveAvatar`/`zRemRangeByScore` helpers, the `activeKey` key helper, and the `ACTIVE_PLAYERS_TTL_SECONDS`/`FIVE_MINUTES_MS` constants; `getSocialProof` now returns only `recentSolvers`. No more writes/reads to `social:active:{postId}`.
  - `src/server/core/preview.ts`: removed the local `getActivePlayers` helper and the "solving now" stat block from the preview card; `buildPreviewHtml`/`refreshPostPreview` updated accordingly.
- **Shared**:
  - `src/shared/viral-types.ts`: removed `activePlayers` from `SocialProofData` and deleted the now-unused `ActivePlayerSummary` and `ActivityType` types.
- **Note**: `/api/social/presence` now returns only `{ recentSolvers }`. The `/api/social/recent-solvers` route is unchanged.
- **Verified**: `bun run test` passes (86/86); `bunx biome check` clean on changed files; `tsc` reports no new errors (the 9 pre-existing `game.ts` errors are unrelated).

---

## 2026-06-13

### Remove the "players solved today" counter feature

Removed the solved-today counter end-to-end: the game-screen widget, the social-proof API field, the backing Redis read/write, and the post-preview stat.

- **Client**:
  - Deleted `src/client/components/SolveCounter.svelte`.
  - `src/client/components/SocialPresence.svelte`: removed the `SolveCounter` import, the `solvedToday` derived value, and the "Today's solve count" render block.
- **Server**:
  - `src/server/lib/social.ts`: removed `getSolvedTodayCount` and the `solveCountKey` helper; dropped `solvedTodayCount` from the `recordHeartbeat` and `getActivePlayers` return values and `solvedToday` from `getSocialProof`; removed the `social:solvecount:{date}` increment/TTL from `recordSolve`; dropped the now-unused `todayISO` import.
  - `src/server/core/preview.ts`: removed the `getSolveCount` helper and the "solved today" stat block from the preview card; updated `buildPreviewHtml`/`refreshPostPreview` accordingly; dropped the now-unused `todayISO` import and header doc reference.
- **Shared**:
  - `src/shared/viral-types.ts`: removed `solvedTodayCount` from `ActivePlayerSummary` and `solvedToday` from `SocialProofData`.
- **Note**: `getActivePlayers` ("solving now"), recent solvers, and top-3 solvers are unchanged. The `/api/social/presence` response no longer includes `solvedToday`.
- **Verified**: `bun run test` passes (86/86); `bunx biome check` clean on changed files; `tsc` reports no new errors (the 9 pre-existing `game.ts` errors are unrelated).

---

## 2026-06-13

### Remove the "Challenge a player" (1v1 challenge) feature

Removed the head-to-head challenge feature end-to-end, including its UI, client store, server APIs, and shared logic.

- **Client**:
  - Deleted components `ChallengePanel.svelte`, `ChallengeCreate.svelte`, `ChallengeItem.svelte`, `ChallengeList.svelte`, and `ChallengeRace.svelte`.
  - Deleted the `src/client/stores/challenge.ts` store (polling, create/accept/submit).
  - `src/client/App.svelte`: removed the `ChallengePanel` import, the `puzzleId` derived value, and the auth-gated challenge panel block. Dropped the now-unused `isAuthenticated` state; the user-context effect now only tracks `isModerator`.
- **Server**:
  - Deleted `src/server/routes/challenge.ts` (all `/api/challenge/*` endpoints: create, accept, pending, history, complete, status) and `src/server/lib/challenge.ts`.
  - `src/server/routes/index.ts`: removed the `challengeRoutes` import and registration.
  - `src/server/lib/social.ts`: dropped `pendingChallenges` from `getSocialProof` (now takes only `postId`) and removed the now-unused `lRange` helper.
  - `src/server/routes/social.ts`: updated the presence route to call `getSocialProof(postId)`.
  - `src/server/lib/viral-analytics.ts`: removed `challengesSent`/`challengesCompleted` counter reads from `getDailyMetrics`.
- **Shared**:
  - Deleted `src/shared/challenge-logic.ts`.
  - `src/shared/viral-types.ts`: removed `Challenge`, `ChallengeResult`, `ChallengeNotification`, and `ChallengeState` types; removed `challengesSent`/`challengesCompleted` from `DailyViralMetrics` and `pendingChallenges` from `SocialProofData`.
  - `src/shared/viral-analytics.ts`: dropped the "Challenges" column and "Total Challenges" summary from `formatMetricsAsMarkdown`.
  - `src/shared/growth.test.ts`: renamed a misleadingly-named test ("rotates the challenge mission by date" → "rotates the mission set by date"); the daily missions never included a challenge mission.
- **Verified**: `bun run test` passes (86/86); `bunx biome check` is clean on changed files. The 9 pre-existing `tsc` errors in `src/client/stores/game.ts` are unrelated (confirmed identical with these changes stashed).

---

## 2026-06-13

### Fix `e.exclude.has is not a function` crash from duplicate Svelte runtimes

- **Root cause**: `node_modules` was a mixed/corrupted install. Although `bun.lock` was the only tracked lockfile (bun is the active package manager), the tree still held stale **pnpm** artifacts — `.pnpm/svelte@5.55.7`, `.pnpm/@lucide+svelte@1.16.0`, and `.ignored/svelte@5.51.3` — alongside the hoisted `svelte@5.56.3`. With multiple Svelte runtimes present, the Lucide `Icon.svelte` (used by `Dropdown.svelte` via `chevron-down`) was compiled against one Svelte version while linked to another's `svelte/internal/client` runtime. `rest_props`'s `exclude` argument changed from an array to a `Set` between versions, producing `TypeError: e.exclude.has is not a function`.
- **Fix**: clean reinstall — removed `node_modules` (and stale Vite caches) and reinstalled with `bun install`, leaving a single `svelte@5.56.3` / `@lucide/svelte@1.18.0`; the `.pnpm` and `.ignored` leftovers are gone.
- **Prevention**: pinned `"packageManager": "bun@1.3.14"` in `package.json` so contributors and CI use one package manager (corepack-enforced), preventing the pnpm/bun mixing that caused the duplicate runtimes.
- **Verified**: built and served `dist/client` statically, loaded in a browser, and confirmed the difficulty `Dropdown` and its chevron icon render with no `props.js`/`Icon.svelte` error (only expected `/api/*` 404s from having no local backend).
- **Note**: no Vite `resolve.dedupe` was added — `@sveltejs/vite-plugin-svelte` already injects `resolve.dedupe` for `svelte` and all its subpath exports (including `svelte/internal/client`) unconditionally, so a manual entry would be redundant and incomplete.

### Standardize tooling on Bun

- Reconciled the package-manager discrepancy that allowed the duplicate-runtime corruption above: the repo uses bun (`bun.lock`) but docs/scripts referenced pnpm/npm.
- **`AGENTS.md`**: changed "Pnpm — Package manager" to "Bun", and converted the setup and development command blocks from `pnpm ...` to `bun run ...`.
- **`package.json`**: replaced `npm run ...` in `postinstall`, `deploy`, and `launch` scripts with `bun run ...` (uses `bun run` rather than `bun build`/`bun test` to avoid invoking Bun's built-in bundler/test runner).

---

## 2026-06-13

### Rewrite timer.ts and game.ts for clarity and correctness

- **`src/client/stores/timer.ts`**:
  - Removed unused `export` wrapper on `elapsedSeconds` — now exported directly.
  - Collapsed multi-line arrow functions to single-line where trivially readable.
  - No behaviour change; cosmetic tightening only.

- **`src/client/stores/game.ts`** — significant rewrite, same external API:
  - **Extracted `clearErrorTimer`**: the `if (errorTimer) { clearTimeout; = undefined }` block was duplicated in `cycleCell`, `undo`, and `useHint`. Now a single helper.
  - **Extracted `scheduleErrorDisplay`**: the deferred error-display `setTimeout` block was copy-pasted verbatim in `cycleCell` and `useHint`. Now one function that returns the handle.
  - **Extracted `startTimerOnFirstInput`**: documents intent at call sites; `useHint` uses it instead of the raw `if (!wasTracked) startTimer()` inline.
  - **`getNextCellValue`**: replaced if-chain with a lookup map (`NEXT_CELL_VALUE`) — the three-state cycle is now a data declaration, not procedural logic.
  - **`createFixedSet`**: replaced manual `for` loop with `new Set(fixed.map(...))`.
  - **`useHint`**: replaced nested `for` loops with `flatMap + filter` to collect empty cells; removed `let hintApplied` mutation flag — the function now returns early on every failure path, so reaching the end implies success. Removed 6 of the 9 early-return guards.
  - **`autosubmitIfSolved`**: removed redundant `!snapshot` null check (writable store always has a value); added early return on `!res.ok` to reduce nesting; replaced long if-chain with sequential single-line conditionals.
  - **`cycleCell`**: removed redundant guards inside `game.update` (pre-update snapshot guards are sufficient); simplified return object.
  - **`undo`**: simplified return object.
  - `GameState.errorLocations` type is now inline (was split across multiple lines unnecessarily).

---

## 2026-06-13

- **`src/client/stores/timer.ts`**:
  - Unified environment guard: replaced inconsistent `canUseWindow` / `typeof window` pattern with a single `isBrowser` helper using `typeof document`.
  - Renamed `timerStarted` → `timerEngaged` to accurately express that the flag means "user has engaged with the puzzle", not "timer is currently running".
  - Added comment to `stopTimer` explaining why it intentionally does not clear `timerEngaged` (pause mid-game must still allow visibilitychange to resume).
  - Added comment to `visibilitychange` registration explaining the single-instance / no-cleanup intent.

- **`src/client/stores/game.ts`**:
  - **Bug fix (`useHint`)**: `game.update` now sets `firstInputTracked: true` so that a hint used as the first action correctly marks the puzzle as engaged. Previously, a subsequent cell tap would see `firstInputTracked === false` and double-fire the `first_input` growth event.
  - **Bug fix (`cycleCell`)**: Renamed `shouldTrackFirstInput` → `wasFirstInput` and added an early-return guard for non-interactable states (`solved`, `loading`, fixed cell) before entering `game.update`, removing the duplicate status checks that were inside the updater. The store update now atomically flips `firstInputTracked`, so any concurrent tap sees it as already set.

---

## 2026-06-13

- **`src/client/stores/timer.ts`**:
  - Added `timerStarted` flag to track whether the user has engaged with the puzzle yet.
  - Added `visibilitychange` listener: pauses the timer when the user scrolls away / switches tabs, resumes when they return — but only if the timer had already been started by a cell interaction.
  - `resetTimer` now also clears `timerStarted` so a new puzzle starts fresh.

- **`src/client/stores/game.ts`**:
  - Imported `startTimer` — game store now owns the timer start responsibility.
  - `cycleCell`: calls `startTimer()` alongside `trackGrowthEvent('first_input')` on first real cell tap.
  - `useHint`: calls `startTimer()` when `!snapshot.firstInputTracked`, so using a hint before touching any cell also starts the clock.

- **`src/client/App.svelte`**:
  - Removed `startTimer` import — App no longer manages the timer lifecycle.
  - `handleDifficultyChange` no longer calls `startTimer()` after loading a new puzzle.
  - `loadPuzzle` called without `.then(() => startTimer())` — puzzle loads silently, timer stays at zero until first interaction.

---

### Fix timer race condition and dead code from preview screen removal

- **`src/client/App.svelte`**:
  - Fixed race condition: changed `loadPuzzle(...); startTimer()` to `loadPuzzle(...).then(() => startTimer())` so the timer only starts after the puzzle has fully loaded, matching the original `startGame()` contract and avoiding being reset by `resetTimer()` inside `loadPuzzle`.
  - Removed `?? 'medium'` fallback — `$game.difficulty` is always `'medium'` at init since the store's initial state defines it; the fallback was redundant and obscured the store as the source of truth.
  - Removed dead `PlayOverlay` import and `<PlayOverlay />` tag — with `showPlayOverlay` defaulting to `false` and no code path calling `openPlayOverlay()`, the component was permanently invisible and mounting for nothing.

---

## 2026-06-13

### Skip preview screen — load game directly on post open

- **`src/client/stores/ui.ts`**: Changed `showPlayOverlay` initial value from `true` to `false` so the play overlay is never shown on load.
- **`src/client/App.svelte`**: Added `loadPuzzle($game.difficulty ?? 'medium')` and `startTimer()` calls at module init (alongside the existing `fetchStreak`, `loadDailyProgress`, and `trackGrowthEvent` calls), so the puzzle loads and the timer starts immediately without requiring the user to click PLAY.

---

## 2026-05-17

### Viral Social Engine — Wire Components into App.svelte (task 11.4)

- **Added `GET /api/user/is-moderator` endpoint** in `src/server/routes/user.ts`:
  - Returns `{ isAuthenticated: boolean, isModerator: boolean }` for the current Devvit context user.
  - Unauthenticated users receive `{ isAuthenticated: false, isModerator: false }`.
  - Uses the same `getModerators` pattern as the admin route; fails safe to `{ isAuthenticated: true, isModerator: false }` on any Reddit API error.

- **Updated `src/client/App.svelte`**:
  - Imported and mounted `SocialPresence`, `ChallengePanel`, and `AdminDashboard`.
  - Added `$effect` to fetch `/api/user/is-moderator` on load, populating `isAuthenticated` and `isModerator` reactive state.
  - `SocialPresence` is rendered below the grid for all users (including unauthenticated), receiving `postId` derived from `$game.puzzleId`.
  - `ChallengePanel` is rendered below `SocialPresence`, gated on `isAuthenticated && puzzleId` (requires a loaded puzzle and authenticated user).
  - `AdminDashboard` is rendered at the bottom, gated on `isModerator` (client-side cosmetic gate; server enforces access independently).
  - All new state uses Svelte 5 runes (`$state`, `$derived`, `$effect`); no style blocks added.



### Viral Social Engine — Admin Dashboard Component

- **Added `src/client/components/AdminDashboard.svelte`** (task 10.5):
  - Accepts `isModerator: boolean` prop; renders nothing when `false` (client-side cosmetic gate per requirement 6.4).
  - On mount, calls `fetchMetrics(14)` from the metrics store to load 14-day rolling data.
  - Displays a spinner loading state while `$metricsStore.loading` is `true`.
  - Shows a red error message via `role="alert"` when `$metricsStore.error` is non-null.
  - Renders five `MetricsKPI` cards (DAU, K-Factor, Share Rate, D1 Retention, D7 Retention) — always present, showing `—` on fetch failure rather than being hidden.
  - Each KPI card receives a sparkline array built from all 14 days of data (oldest → newest), with share/retention values converted to percentages.
  - Renders `FunnelViz` with the most recent day's funnel data, falling back to an all-zero funnel on failure.
  - Renders `CopyButton` wired to `copyMetricsToClipboard()` from the metrics store.
  - Uses Svelte 5 runes syntax (`$props`, `$derived`, `onMount`), Tailwind CSS v4 classes, and no external chart libraries.

## 2026-05-15

### Dependencies

Updated requested packages:
- `@devvit/web`: 0.12.16 → 0.12.23
- `@hono/node-server`: 1.19.14 → 2.0.2
- `devvit`: 0.12.16 → 0.12.23
- `vite`: 8.0.3 → 8.0.13

### Growth Features

- **Added Reddit-native growth loop infrastructure**:
  - Added `/api/events` for allowlisted funnel events such as app opens, puzzle starts, first input, share success, join success, and streak saves.
  - Added `/api/daily-progress` with daily trio progress, deterministic daily missions, streak freeze counts, and current streak state.
  - Added `/api/player-context` with rank, faster-than percentile, next-rank gap, top-10 cutoff, best difficulty today, and completed difficulties.
  - Added shared growth utilities for solve-quality labels, daily missions, trio summaries, percentile math, UTC week IDs, and streak-freeze earning.

- **Moved score sharing toward a compliant score-thread model**:
  - Daily post creation now attempts to create an app-authored score thread comment, sticky it, and store `post:{postId}:scoreThreadCommentId`.
  - Added `/api/share-score` so user-triggered score shares reply to the stored score thread by default.
  - Kept `/api/share-comment` as a backward-compatible wrapper.
  - Score comments now include richer status like solve quality, streak, rank, and “Beat my time” template text.

- **Expanded post-solve recognition and retention surfaces**:
  - Submissions now accept `hintsUsed`, `mistakeCount`, and `undoCount`.
  - Solves are labeled as `clean`, `sharp`, `comeback`, or `assisted`.
  - The success modal now shows solve quality, faster-than percentile, next-rank gap, daily trio progress, perfect/trio completion, and streak freezes.
  - The client now records first input, puzzle start, share preview/success, leaderboard open, shop open, and subreddit join events.
  - The play overlay warms the daily puzzle and shows daily progress/mission context before play.

- **Added weekly Reddit ritual support**:
  - Added `/internal/schedule/weekly-recap` and moderator menu item `/internal/menu/create-weekly-recap`.
  - Weekly recap posts summarize the current UTC week’s easy/medium/hard leaderboards.
  - Removed automatic daily crossposting from the daily scheduler so crossposts can be milestone/feedback driven instead.

- **Improved economy and streak safeguards**:
  - Added `economy:ledger:{userId}:{eventId}` reward idempotency so repeated solves cannot farm base rewards.
  - Added daily-trio, weekly difficulty leaderboard, and deterministic weekly league Redis writes.
  - Added earnable streak freezes at five-day intervals, capped at two, with automatic one-day save support.

### Tests

- Added unit tests for solve-quality derivation, daily mission rotation, trio summary, percentile math, and streak-freeze earning.
- Added route tests for analytics events, daily progress, player context, score-thread sharing, and duplicate share idempotency.
## 2026-04-30

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: 0.12.18 → 0.12.21
- `@devvit/test`: 0.12.18 → 0.12.21
- `@devvit/web`: 0.12.18 → 0.12.21
- `@hono/node-server`: 1.19.13 → 2.0.1
- `@lucide/svelte`: 1.8.0 → 1.14.0
- `@tailwindcss/vite`: 4.2.2 → 4.2.4
- `devvit`: 0.12.18 → 0.12.21
- `fast-check`: 4.6.0 → 4.7.0
- `hono`: 4.12.12 → 4.12.16
- `svelte`: 5.55.2 → 5.55.5
- `tailwindcss`: 4.2.2 → 4.2.4
- `@types/node`: 25.5.2 → 25.6.0
- `typescript`: 6.0.2 → 6.0.3
- `vite`: 8.0.8 → 8.0.10
- `vitest`: 4.1.4 → 4.1.5

## 2026-04-09

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: 0.12.17 → 0.12.18
- `@devvit/test`: 0.12.17 → 0.12.18
- `@devvit/web`: 0.12.17 → 0.12.18
- `@hono/node-server`: 1.19.12 → 1.19.13
- `@lucide/svelte`: 1.7.0 → 1.8.0
- `devvit`: 0.12.17 → 0.12.18
- `hono`: 4.12.10 → 4.12.12
- `@types/node`: 25.5.0 → 25.5.2
- `svelte`: 5.55.1 → 5.55.2
- `vite`: 8.0.3 → 8.0.8
- `vitest`: 4.1.2 → 4.1.4

## 2026-04-02

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: 0.12.16 → 0.12.17
- `@devvit/test`: 0.12.16 → 0.12.17
- `@devvit/web`: 0.12.16 → 0.12.17
- `@hono/node-server`: 1.19.11 → 1.19.12
- `devvit`: 0.12.16 → 0.12.17
- `hono`: 4.12.9 → 4.12.10
- `svelte`: 5.55.0 → 5.55.1
- `svelte-check`: 4.4.5 → 4.4.6
## 2026-03-26

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: 0.12.15 → 0.12.16
- `@devvit/test`: 0.12.15 → 0.12.16
- `@devvit/web`: 0.12.15 → 0.12.16
- `@lucide/svelte`: 0.577.0 → 1.7.0
- `devvit`: 0.12.15 → 0.12.16
- `hono`: 4.12.8 → 4.12.9
- `svelte`: 5.54.0 → 5.55.0
- `typescript`: 5.9.3 → 6.0.2
- `vite`: 8.0.1 → 8.0.3
- `vitest`: 4.1.0 → 4.1.1

## 2026-03-19

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: 0.12.14 → 0.12.15
- `@devvit/test`: 0.12.14 → 0.12.15
- `@devvit/web`: 0.12.14 → 0.12.15
- `@hono/node-server`: 1.19.11
- `@lucide/svelte`: 0.574.0 → 0.577.0
- `@tailwindcss/vite`: 4.2.1 → 4.2.2
- `canvas-confetti`: 1.9.4
- `devvit`: 0.12.14 → 0.12.15
- `hono`: 4.12.7 → 4.12.8
- `tailwindcss`: 4.2.1 → 4.2.2
- `@sveltejs/vite-plugin-svelte`: 7.0.0
- `@types/canvas-confetti`: 1.9.0
- `@types/node`: 25.4.0 → 25.5.0
- `concurrently`: 9.2.1
- `dotenv-cli`: 11.0.0
- `fast-check`: 4.6.0
- `svelte`: 5.53.10 → 5.54.0
- `svelte-check`: 4.4.5
- `typescript`: 5.9.3
- `vite`: 7.3.1 → 8.0.1
- `vitest`: 4.0.18 → 4.1.0

## 2026-02-24

### Dependencies

Updated packages to latest versions:
- `@lucide/svelte`: 0.574.0 → 0.575.0
- `@tailwindcss/vite`: 4.2.0 → 4.2.1
- `tailwindcss`: 4.2.0 → 4.2.1
- `@sveltejs/vite-plugin-svelte`: 6.2.4 → 7.0.0
- `svelte`: 5.53.2 → 5.53.3
- `vite`: 8.0.0-beta.14 → 7.3.1

### Bug Fixes

- **Fixed svelte-check failures after dependency upgrade**: Removed unused `index` bindings in `LeaderboardPreview` skeleton/loading loops and removed unused `dayNumberError` state from `SuccessModal`.

## 2026-02-23

### Bug Fixes

- **Fixed streak leaderboard showing "Unknown player" for all users**: Corrected Redis key mismatch between read and write operations for user metadata.
  - Root cause: `submit.ts` was writing user metadata to per-user keys (`user:t2_xxx:meta`) while `leaderboard.ts` was reading from a global hash (`user:meta`)
  - Fix: 
    1. Changed write in `submit.ts` to store in global `user:meta` hash with JSON-serialized values
    2. Added fallback in `leaderboard.ts` to check legacy per-user keys (`user:t2_xxx:meta`) for existing users
  - Files modified: `src/server/routes/submit.ts`, `src/server/routes/leaderboard.ts`

## 2026-02-19

### Bug Fixes

- **Fixed rate limit error on share score button**: Resolved race condition in `/api/share-comment` endpoint where rapid button clicks could cause duplicate Reddit API calls.
  - Root cause: Redis idempotency key was set AFTER the Reddit API call, allowing concurrent requests to bypass the check
  - Fix: Set Redis key BEFORE calling Reddit API (optimistic locking pattern)
  - Added rollback: If Reddit API fails, the Redis key is deleted to allow retry
  - Files modified: `src/server/routes/share.ts`

### Features

- **Added attempts counter to leaderboard**: Players can now see how many tries each competitor needed to solve the puzzle.
  - Added `attempts` field to `LeaderboardEntry` type
  - Attempts are tracked per user per puzzle in Redis metadata
  - Each submission increments the attempt counter
  - New "Tries" column displayed in the leaderboard modal
  - Files modified:
    - `src/shared/types/leaderboard.ts` - Added `attempts` field
    - `src/server/routes/utils.ts` - Updated `StoredLeaderboardMeta` type
    - `src/server/routes/submit.ts` - Track attempts on each submission
    - `src/server/routes/leaderboard.ts` - Include attempts in API response
    - `src/client/components/LeaderboardModal.svelte` - Display attempts column

## 2026-02-18

### Dependencies

Updated packages to latest versions:
- `@devvit/start`: 0.12.12 → 0.12.13
- `@devvit/test`: 0.12.12 → 0.12.13
- `@devvit/web`: 0.12.12 → 0.12.13
- `@lucide/svelte`: 0.564.0 → 0.574.0
- `devvit`: 0.12.12 → 0.12.13

### Refactoring: Code Organization & Maintainability

Major codebase reorganization to improve maintainability, reduce code duplication, and enhance developer experience.

#### Phase 1: Shared Utilities Extraction

- **Created `src/shared/utils/grid.ts`**: Extracted common grid operations into a single module
  - `cloneGrid(grid)`: Deep clone a grid
  - `createEmptyGrid()`: Create a 6x6 null grid
  - `countLine(line)`: Count zeros and ones in a line

- **Created `src/shared/utils/format.ts`**: Unified time formatting
  - `formatTime(seconds)`: Format seconds as MM:SS

- **Created `src/shared/constraints.ts`**: Centralized puzzle constraint validation
  - `wouldCreateTripleRun(line, idx, val)`: Check if placing a value creates a triple run
  - `canPlaceValue(grid, r, c, val, reusableCol?)`: Validate if a value can be placed at position

- **Updated consuming files**:
  - `game.ts`: Now uses shared grid utilities
  - `generator.ts`: Uses shared grid utilities and constraints
  - `solver.ts`: Uses shared grid utilities and constraints
  - `timer.ts`: Uses shared format utility
  - `routes.ts`: Uses shared format utility
  - `share-formatter.ts`: Uses shared format utility

#### Phase 2: Routes Module Split

Split monolithic `routes.ts` (804 lines) into focused, single-responsibility modules:

- **`src/server/routes/utils.ts`** (73 lines): Shared constants and helpers
  - HTTP status codes, default values, difficulty validation
  - `todayISO()`, `resolveDate()`, `resolveDifficulty()`
  - `leaderboardKey()`, `clampPageSize()`, `parseLeaderboardMeta()`
  - `ensurePostIdPrefix()`: Helper for Reddit API ID formatting

- **`src/server/routes/puzzle.ts`** (77 lines): Puzzle endpoints
  - `GET /api/puzzle-number`: Get day number for current post
  - `GET /api/puzzle`: Fetch puzzle by difficulty

- **`src/server/routes/user.ts`** (67 lines): User-related endpoints
  - `GET /api/check-joined-status`: Check subreddit membership
  - `POST /api/join-subreddit`: Join subreddit
  - `GET /api/streak`: Get user streak data

- **`src/server/routes/share.ts`** (134 lines): Social sharing endpoints
  - `POST /api/comment-score`: Post solve time as comment
  - `POST /api/share-comment`: Post share text as Reddit comment

- **`src/server/routes/play-count.ts`** (36 lines): Analytics endpoints
  - `GET /api/play-count`: Get play count for post
  - `POST /api/play-count`: Increment play count

- **`src/server/routes/leaderboard.ts`** (223 lines): Leaderboard endpoints
  - `GET /api/leaderboard`: Get puzzle leaderboard with pagination
  - `GET /api/leaderboard/streaks`: Get global streak leaderboard

- **`src/server/routes/submit.ts`** (179 lines): Submission endpoint
  - `POST /api/submit`: Submit puzzle solution with streak tracking

- **`src/server/routes/index.ts`** (25 lines): Main router combining all routes

#### Phase 3: Import Optimization

- **Created barrel export** `src/shared/utils/index.ts` for cleaner imports
- **Updated test import paths** for new route structure
- **Analyzed build optimizations** - current Vite defaults confirmed optimal

### Metrics Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Lines | 6,704 | 6,572 | -132 lines (-2.0%) |
| Source Files | 46 | 57 | +11 files |
| Largest File | 804 lines | 409 lines | -49% |
| Client Bundle (gzip) | 37,057 B | 37,079 B | +22 B (+0.06%) |
| Tests | 67 passed | 67 passed | All passing |

### Benefits

- **Single Source of Truth**: Grid operations and constraints now in one place
- **Reduced Bug Surface**: ~150 lines of duplicate code removed
- **Better Navigation**: Find code by feature, not by scrolling
- **Parallel Development**: Team members can work on different route modules
- **Easier Testing**: Tests can be colocated with their routes

## 2026-02-14

### Features

- **Leaderboard Modal with Difficulty Filters**: Added a new leaderboard modal accessible via the trophy button above the puzzle grid.
  - **Difficulty Filter Buttons**: Toggle buttons (Easy, Medium, Hard) above the table to filter scores by difficulty
  - **Default Difficulty**: Modal defaults to the currently selected game difficulty
  - **Table Format**: Displays top 10 scores as a table with columns: Rank, Player (with avatar), Time
  - **User Rank Display**: Shows the current user's rank above the table when they have a score
  - **Avatar Support**: Displays user avatar images (with fallback placeholder for missing avatars)
  - Updated `LeaderboardModal.svelte` to include all new UI elements
  - Updated `leaderboard.ts` store to support custom page size (10 entries)

### UI Changes

- **App.svelte**: Added trophy icon button next to Timer to open the leaderboard modal

### Bug Fixes

- Leaderboard modal now properly fetches scores for the current date's puzzle based on selected difficulty

### Features

- **Leaderboard Preview on Play Screen**: Added a preview of the top 3 leaderboard entries directly on the play overlay screen (below the PLAY button) to showcase today's fastest solvers before users start the game.
  - Created new `LeaderboardPreview.svelte` component (`src/client/components/LeaderboardPreview.svelte`) that displays up to 3 entries with:
    - **Avatar**: Circular avatar image fetched from Reddit profile (or fallback to initials if no avatar)
    - **Rank**: Special medal emojis (🥇, 🥈, 🥉) with distinctive background colors for 1st, 2nd, and 3rd place
    - **Username**: Displayed with truncation for long names
    - **Time Taken**: Formatted elapsed time in MM:SS format
  - Single unified card layout with dividers between entries (prevents layout overflow)
  - Skeleton loader with animated placeholder rows while fetching data
  - Empty state message: "Be the first to play!" when no entries exist
  - Fully responsive design with proper dark mode support
- **PlayOverlay Integration**: Modified `PlayOverlay.svelte` to:
  - Fetch top 3 leaderboard entries when the overlay opens using existing `/api/leaderboard` endpoint
  - Display `LeaderboardPreview` component below the PLAY button
  - Handle loading states and empty states gracefully
  - Reduced title margin to prevent layout overflow on smaller screens

### UI Improvements

- **LeaderboardPreview Component**:
  - Changed from individual cards to unified single card with horizontal dividers
  - Increased time taken font size from `text-xs` to `text-sm` for better readability
  - Reduced padding and spacing for more compact layout
  - Updated skeleton loader to match new single-card design

- **PlayOverlay Component**:
  - Reduced Binary Grid title bottom margin from `mb-12` to `mb-6` to prevent overflow
  - Improved overall spacing balance between elements

## 2026-01-26

### Documentation

- **architecture.md**: Replaced generic template with a project-specific architecture document. It now describes Binary Grid’s structure (`src/client`, `src/server`, `src/shared`), high-level flow (Reddit → webview client ↔ Devvit Hono server ↔ Redis/Reddit API), core components (Svelte client, Hono server, shared logic), Redis key patterns, external integrations (Devvit/Reddit), deployment (Devvit serverless), security, testing, and a short glossary (Devvit, Custom Post, fixed cells, puzzle ID, etc.).

## 2025-12-20

### Performance Optimizations

- **App.svelte (client)**:
  - Implemented lazy loading for `SuccessModal` and `HowToPlayModal` components using Svelte 5's native `{#await}` blocks with dynamic imports.
  - Reduced initial JavaScript bundle size by approximately 16 kB (modals are now loaded on-demand as separate chunks: `SuccessModal.js` at 13.60 kB and `HowToPlayModal.js` at 1.36 kB).
  - The canvas-confetti library (~50 KB unminified) is now only loaded when users complete a puzzle, significantly improving initial page load performance.
  - Modals are cached by the browser after first load, ensuring instant subsequent opens with no additional network requests.
  - Used Svelte 5 runes-compatible syntax with destructured imports (`{#await import() then { default: Component }}`) to avoid deprecated `<svelte:component>` warnings.

## 2025-12-16

### Changes

- **index.ts (server)**:
  - Added conditional check in the daily scheduler endpoint to only crosspost to RedditGames when the current subreddit is "binarygrid". This prevents unintended crossposts when the app is installed on other subreddits while still maintaining the crosspost functionality for the main binarygrid community.

### Bug Fixes

- **game.ts (client)**:
  - Fixed hint cooldown not resetting when undoing moves. The `undo()` function now calls `resetHintCooldown()` to clear the cooldown timer and re-enable the hint button, maintaining consistency with how other side effects (error timers) are reverted.
  - Fixed `useHint` not populating `errorCells` when a hint creates a validation error. The function now uses the same delayed error display mechanism as `cycleCell`, calling `findErrorCells()` to identify problematic cells and displaying visual X highlighting after a 1-second delay. This ensures users receive consistent visual feedback when hints create invalid grid states (e.g., when combining a correct hint value with existing user-entered values creates three consecutive identical values or exceeds the count limit).
  - Fixed hint cooldown starting even when hint application fails. Added `hintApplied` flag to track successful hint application inside the `game.update()` callback. The `startCooldown()` function and `return true` now only execute when the hint was actually applied to the grid, preventing the cooldown timer from starting when early returns occur (e.g., when `targetRow` is falsy). This ensures users are only penalized with a cooldown when they actually receive a hint.

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
