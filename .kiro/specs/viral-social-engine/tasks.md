# Implementation Plan: Viral Social Engine

## Overview

Implement the Viral Social Engine for Binary Grid in five ordered layers: (1) shared types and pure functions, (2) server-side libraries, (3) server-side routes, (4) client-side stores and components, and (5) wiring into existing submit/share/events routes. Tests are co-located with each module and written immediately after the implementation they cover.

## Tasks

- [x] 1. Define shared types and pure functions for the viral engine
  - [x] 1.1 Create `src/shared/viral-types.ts` with all TypeScript type definitions
    - Export `FunnelEvent`, `DailyViralMetrics`, `FunnelMetrics`, `ChallengeState`, `Challenge`, `ChallengeResult`, `ChallengeNotification`, `ActivePlayerSummary`, `RecentSolver`, `SocialProofData`, `ActivityType`
    - Keep the file framework-agnostic with no side-effects (shared between client and server)
    - _Requirements: 1.1, 2.1, 9.1, 12.1, 14.2_

  - [x] 1.2 Create `src/shared/viral-analytics.ts` with pure computation functions
    - Implement `calculateKFactor(metrics)` — returns 0 when DAU or referredOpens is 0
    - Implement `formatMetricsAsMarkdown(metrics)` — header, separator, data rows, summary section
    - Implement `computeShareRate(shares, dau)` and `computeConversionRate(referredConversions, referredOpens)` helpers
    - No Redis imports; all functions must be deterministic and side-effect-free
    - _Requirements: 4.1, 4.2, 4.3, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 1.3 Write property tests for `calculateKFactor` and `formatMetricsAsMarkdown`
    - **Property 1: K-factor is always non-negative** — `fc.nat()` inputs with `referredConversions ≤ referredOpens`
    - **Validates: Requirements 4.1, 4.4**
    - **Property 2: K-factor is 0 when DAU or referredOpens is 0**
    - **Validates: Requirements 4.2, 4.3**
    - **Property 3: Share rate is non-negative for any positive DAU**
    - **Validates: Requirements 8.4**
    - **Property 8: Metrics markdown output is well-formed** — contains header, separator, data rows, summary
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
    - Co-locate test file at `src/shared/viral-analytics.test.ts`

  - [x] 1.4 Create `src/shared/challenge-logic.ts` with pure challenge computation functions
    - Implement `determineWinner(challengerTime, opponentTime)` — returns `{ winner: 'challenger' | 'opponent', margin: number }`
    - Implement `isValidTransition(currentState, action)` — validates state machine transitions
    - Implement `validateUsername(username)` — alphanumeric + underscores, max 20 chars
    - Implement `validateSolveTime(time)` — positive finite number, max 3600 seconds (0.0 is valid)
    - _Requirements: 14.4, 14.7, 15.1, 15.2, 18.1, 18.3_

  - [ ]* 1.5 Write property tests for `determineWinner` and `isValidTransition`
    - **Property 6: Challenge winner has lower or equal solve time and margin is non-negative**
    - **Validates: Requirements 14.4, 14.7**
    - **Property 5: Challenge state machine only allows valid transitions**
    - **Validates: Requirements 15.1, 15.2**
    - Co-locate test file at `src/shared/challenge-logic.test.ts`

- [x] 2. Implement the Viral Analytics server library
  - [x] 2.1 Create `src/server/lib/viral-analytics.ts` — user bit index and DAU tracking
    - Implement `getUserBitIndex(userId)` — atomic allocation via `viral:user-index:counter`, idempotent re-reads
    - Implement `trackDau(userId, date)` — `SETBIT viral:dau:{date}` with 60-day TTL
    - Implement `trackImpression(postId, date)` — `PFADD viral:impressions:{date}` with 60-day TTL
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Add funnel event and referral tracking to `src/server/lib/viral-analytics.ts`
    - Implement `trackFunnelEvent(event, date)` — `INCRBY viral:funnel:{date}:{event}` with 60-day TTL
    - Implement `trackShare(userId, date)` — increments `viral:daily:{date}:shares`
    - Implement `trackReferredOpen(userId, date)` — increments `viral:daily:{date}:referred_opens`
    - Implement `trackReferredConversion(userId, date)` — increments `viral:daily:{date}:referred_converts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.3 Add retention cohort tracking to `src/server/lib/viral-analytics.ts`
    - Implement `trackRetentionOnOpen(userId)` — records cohort date on first visit; sets D1/D7/D30 bits on return visits
    - Implement `getRetentionRate(cohortDate, dayOffset)` — returns `retained / cohortSize`, 0 when cohortSize is 0
    - Apply 90-day TTL to all retention bitmap keys
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.4 Write property test for `getUserBitIndex` idempotency
    - **Property 4: User bit index is stable (idempotent)** — same userId always returns same index
    - **Validates: Requirements 1.2, 1.3**
    - **Property 7: Retention rate is bounded [0, 1]**
    - **Validates: Requirements 3.5, 3.6**
    - Co-locate test file at `src/server/lib/viral-analytics.test.ts`; use the existing Redis mock pattern from `routes.growth.test.ts`

  - [x] 2.5 Add metrics aggregation to `src/server/lib/viral-analytics.ts`
    - Implement `getDailyMetrics(date)` — reads all counters for a single date, defaults missing keys to 0
    - Implement `aggregateMetrics(days)` — returns exactly `days` entries ordered most-recent-first
    - Implement `getFunnelMetrics(date)` — reads all 6 funnel stage counters
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 3. Implement the Challenge System server library
  - [x] 3.1 Create `src/server/lib/challenge.ts` — challenge creation and deduplication
    - Implement `createChallenge(challengerId, opponentUsername, puzzleId)` — resolves opponent from `user:meta`, checks dedup lock, creates hash with 1-hour TTL, pushes to pending inbox, increments `challenges_sent`
    - Implement `resolveOpponentId(username)` — looks up userId from `user:meta` hash
    - Enforce: self-challenge rejection, active-pair dedup, rate limit (5 pending/hour), opponent-not-found 404
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 3.2 Add challenge state transitions to `src/server/lib/challenge.ts`
    - Implement `acceptChallenge(challengeId, userId)` — transitions `pending → active`, sets 30-min TTL, removes from pending inbox
    - Implement `completeChallenge(challengeId, userId, solveTime)` — records time, determines winner when both complete, transitions to `finished`, increments `challenges_completed`, appends to history with LTRIM 20
    - Implement `getChallengeStatus(challengeId)` — returns `{ state: 'expired', reason: 'timeout' }` when key is absent
    - Implement `getPendingChallenges(userId)` — reads `user:{userId}:challenges:pending` list
    - Use `isValidTransition` and `determineWinner` from `src/shared/challenge-logic.ts`
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 15.1, 15.2, 15.5, 15.6_

  - [ ]* 3.3 Write unit tests for the challenge library
    - Test full lifecycle: create → accept → complete (both players) → winner determined
    - Test invalid transitions throw errors (finished → accept, expired → complete)
    - Test self-challenge rejection and duplicate-pair rejection
    - Test `getChallengeStatus` returns expired shape when key is absent
    - Co-locate test file at `src/server/lib/challenge.test.ts`; use the existing Redis mock pattern

- [x] 4. Implement the Social Presence server library
  - [x] 4.1 Create `src/server/lib/social.ts` — heartbeat and active player tracking
    - Implement `recordHeartbeat(postId, userId)` — `ZADD social:active:{postId}`, prune entries older than 5 minutes via `ZREMRANGEBYSCORE`, set 24-hour TTL, return `ActivePlayerSummary`
    - Implement `getActivePlayers(postId)` — reads count and top-5 recent avatars from `user:meta`; substitutes `{ username: 'Player', avatarUrl: null }` when metadata is missing
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.6_

  - [x] 4.2 Add solver tracking and social proof to `src/server/lib/social.ts`
    - Implement `recordSolve(userId, puzzleId, solveTime)` — increments `social:solvecount:{date}`, adds to `social:solvers:{puzzleId}` ZSET, trims to last 10 via `ZREMRANGEBYRANK`
    - Implement `getRecentSolvers(puzzleId, limit)` — reads ZSET, resolves usernames from `user:meta`
    - Implement `getSocialProof(postId, userId?)` — aggregates active players, solve count, recent solvers, and pending challenge count for the authenticated user
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 17.1, 17.3, 17.4, 19.4, 19.5_

  - [ ]* 4.3 Write unit tests for the social presence library
    - Test heartbeat prunes stale entries and returns correct count
    - Test `getActivePlayers` returns 0 when no entries exist in the 5-minute window
    - Test `getSocialProof` returns 0 for pending challenges when none exist
    - Test avatar fallback when `user:meta` is missing
    - Co-locate test file at `src/server/lib/social.test.ts`

- [x] 5. Checkpoint — Ensure all server library tests pass
  - Run `pnpm test` and confirm all tests in `src/server/lib/` and `src/shared/` pass; ask the user if questions arise.

- [x] 6. Implement server routes for viral analytics and admin
  - [x] 6.1 Create `src/server/routes/viral-analytics.ts`
    - `POST /api/viral/impression` — no auth required; calls `trackImpression(postId, date)`
    - `POST /api/viral/funnel` — requires auth; validates `FunnelEvent` enum; calls `trackFunnelEvent`
    - Validate all inputs; return 400 with descriptive message on failure
    - _Requirements: 2.1, 2.5, 18.5_

  - [x] 6.2 Create `src/server/routes/admin.ts`
    - `GET /api/admin/metrics` — validates moderator via Devvit context; validates `days` is a positive integer; calls `aggregateMetrics(days)`; returns 403 for non-moderators
    - `GET /api/admin/metrics/export` — same moderator gate; returns `{ markdown: formatMetricsAsMarkdown(metrics) }`
    - _Requirements: 5.1, 6.1, 6.2, 6.3, 6.4, 8.1, 18.4_

  - [x] 6.3 Create `src/server/routes/social.ts`
    - `GET /api/social/presence` — no auth required; calls `getSocialProof(postId, userId?)`
    - `POST /api/social/heartbeat` — requires auth; calls `recordHeartbeat(postId, userId)`
    - `GET /api/social/recent-solvers` — no auth required; calls `getRecentSolvers(puzzleId, 5)`
    - _Requirements: 9.1, 10.1, 10.2, 11.2_

  - [x] 6.4 Create `src/server/routes/challenge.ts`
    - `POST /api/challenge/create` — requires auth; validates `opponentUsername` (alphanumeric + underscores, max 20 chars) and `puzzleId`; calls `createChallenge`
    - `POST /api/challenge/accept` — requires auth; validates `challengeId`; calls `acceptChallenge`
    - `POST /api/challenge/:id/complete` — requires auth; validates solve time (positive finite, ≤ 3600); calls `completeChallenge`
    - `GET /api/challenge/:id/status` — requires auth; calls `getChallengeStatus`
    - `GET /api/challenge/pending` — requires auth; calls `getPendingChallenges`
    - `GET /api/challenge/history` — requires auth; reads `user:{userId}:challenges:history`
    - _Requirements: 12.1, 12.6, 12.7, 12.8, 13.1, 13.5, 14.1, 14.3, 15.5, 18.1, 18.2, 18.3, 18.5_

  - [x] 6.5 Register all new routes in `src/server/routes/index.ts`
    - Import and mount `viralAnalyticsRoutes`, `adminRoutes`, `socialRoutes`, `challengeRoutes`
    - _Requirements: 5.1, 6.1, 9.1, 12.1_

  - [ ]* 6.6 Write route integration tests for admin and challenge endpoints
    - Test `GET /api/admin/metrics` returns 403 for non-moderator context
    - Test `POST /api/challenge/create` rejects self-challenge and duplicate pairs
    - Test `POST /api/challenge/:id/complete` with both players completing determines correct winner
    - Test `GET /api/challenge/:id/status` returns expired shape when key is absent
    - Co-locate test file at `src/server/routes.viral.test.ts`; extend the existing Redis mock

- [x] 7. Implement client-side Svelte stores
  - [x] 7.1 Create `src/client/stores/social.ts`
    - Export `socialStore` writable with `SocialProofData | null` state
    - Export `startSocialPolling(postId)` — polls `GET /api/social/presence` every 15 seconds; returns cleanup function
    - Export `stopSocialPolling()` — clears the interval
    - Export `sendHeartbeat(postId)` — `POST /api/social/heartbeat`
    - _Requirements: 11.1, 11.3, 11.4_

  - [x] 7.2 Create `src/client/stores/challenge.ts`
    - Export `challengeStore` writable with `{ pending: ChallengeNotification[], active: Challenge | null, result: ChallengeResult | null }`
    - Export `startPendingPolling()` — polls `GET /api/challenge/pending` every 10 seconds
    - Export `startActivePolling(challengeId)` — polls `GET /api/challenge/:id/status` every 3 seconds
    - Export `stopAllPolling()` — clears all intervals
    - Export `createChallenge(opponentUsername, puzzleId)`, `acceptChallenge(challengeId)`, `submitChallengeTime(challengeId, solveTime)`
    - _Requirements: 13.1, 14.1_

  - [x] 7.3 Create `src/client/stores/metrics.ts`
    - Export `metricsStore` writable with `{ loading: boolean, error: string | null, metrics: DailyViralMetrics[] | null }`
    - Export `fetchMetrics(days?)` — `GET /api/admin/metrics?days=14`
    - Export `copyMetricsToClipboard()` — calls `formatMetricsAsMarkdown` and `navigator.clipboard.writeText`
    - Import `formatMetricsAsMarkdown` from `src/shared/viral-analytics.ts`
    - _Requirements: 5.1, 7.1_

- [x] 8. Implement Social Presence Svelte components
  - [x] 8.1 Create `src/client/components/SocialPresence.svelte`
    - Props: `postId: string`
    - On mount: call `startSocialPolling(postId)` and `sendHeartbeat(postId)`; on destroy: call `stopSocialPolling()`
    - Display active player count ("X solving now") and today's solve count
    - Show placeholder state while `$socialStore` is null
    - Render for all users including unauthenticated (counts visible to all)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 17.1_

  - [x] 8.2 Create `src/client/components/RecentAvatars.svelte`
    - Props: `solvers: Array<{ userId: string; username: string; avatarUrl: string | null }>`
    - Render up to 5 avatar circles; use initials fallback when `avatarUrl` is null
    - _Requirements: 10.1, 10.6_

  - [x] 8.3 Create `src/client/components/SolveCounter.svelte`
    - Props: `count: number`
    - Display "X players solved today" with the actual count (shows 0 when count is 0)
    - _Requirements: 10.2, 17.1_

- [x] 9. Implement Challenge Panel Svelte components
  - [x] 9.1 Create `src/client/components/ChallengeCreate.svelte`
    - Props: `puzzleId: string`
    - Input field for opponent username with client-side validation (alphanumeric + underscores, max 20 chars)
    - On submit: calls `createChallenge` from challenge store; shows error toast on failure
    - Only renders when user is authenticated
    - _Requirements: 12.1, 12.6, 12.7, 12.8, 18.1_

  - [x] 9.2 Create `src/client/components/ChallengeItem.svelte`
    - Props: `challenge: ChallengeNotification`
    - Displays challenger username, puzzle ID, and "Accept" button
    - On accept: calls `acceptChallenge` from challenge store
    - _Requirements: 13.1, 13.5_

  - [x] 9.3 Create `src/client/components/ChallengeList.svelte`
    - Reads `$challengeStore.pending`; renders a `ChallengeItem` for each pending challenge
    - Shows empty state when no pending challenges exist
    - _Requirements: 13.1, 17.4_

  - [x] 9.4 Create `src/client/components/ChallengeRace.svelte`
    - Props: `challenge: Challenge`
    - Polls challenge status every 3 seconds while state is `active`
    - Displays opponent username and a "Submit my time" button that calls `submitChallengeTime`
    - Shows result (winner, margin) when state transitions to `finished`
    - _Requirements: 14.1, 14.5_

  - [x] 9.5 Create `src/client/components/ChallengePanel.svelte`
    - Composes `ChallengeCreate`, `ChallengeList`, and `ChallengeRace`
    - On mount: calls `startPendingPolling()`; on destroy: calls `stopAllPolling()`
    - Only renders when user is authenticated
    - _Requirements: 13.1, 14.1, 17.3, 17.4_

- [x] 10. Implement Admin Dashboard Svelte components
  - [x] 10.1 Create `src/client/components/Sparkline.svelte`
    - Props: `values: number[], width?: number, height?: number, color?: string`
    - Renders a pure inline SVG polyline; no external chart library
    - Normalizes values to fit within the SVG viewport
    - _Requirements: 5.3_

  - [x] 10.2 Create `src/client/components/MetricsKPI.svelte`
    - Props: `label: string, value: string | number, sparklineValues?: number[]`
    - Renders a KPI card with label, formatted value, and optional `Sparkline`
    - Shows empty/zero state when value is null (not hidden)
    - _Requirements: 5.2_

  - [x] 10.3 Create `src/client/components/FunnelViz.svelte`
    - Props: `funnel: FunnelMetrics`
    - Renders a horizontal bar chart using inline SVG for each funnel stage: impression → open → start → complete → share → refer_open
    - _Requirements: 5.4_

  - [x] 10.4 Create `src/client/components/CopyButton.svelte`
    - Props: `onCopy: () => Promise<void>`
    - Renders "Copy to Clipboard" button; shows "Copied!" feedback for 2 seconds after success
    - _Requirements: 7.1_

  - [x] 10.5 Create `src/client/components/AdminDashboard.svelte`
    - Props: `isModerator: boolean`
    - Only renders when `isModerator === true`
    - On mount: calls `fetchMetrics(14)` from metrics store
    - Shows loading state while `$metricsStore.loading` is true
    - Shows error message when `$metricsStore.error` is non-null
    - Renders `MetricsKPI` cards for DAU, K-factor, share rate, D1 retention, D7 retention (shows empty cards on fetch failure, not hidden)
    - Renders `FunnelViz` and `CopyButton`
    - `CopyButton` calls `copyMetricsToClipboard()` from metrics store
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.4, 7.1_

- [x] 11. Wire viral engine into existing routes and App.svelte
  - [x] 11.1 Augment `src/server/routes/growth.ts` — wire viral tracking into `/api/events`
    - On `app_open`: call `trackRetentionOnOpen(userId)`, `trackFunnelEvent('open', date)`, `trackDau(userId, date)`
    - On `puzzle_start`: call `trackFunnelEvent('start', date)`
    - On `submit_success`: call `trackFunnelEvent('complete', date)`, `recordSolve(userId, puzzleId, solveTime)` (increment `social:solvecount`)
    - On `share_success`: call `trackFunnelEvent('share', date)`, `trackShare(userId, date)`
    - Import from `src/server/lib/viral-analytics.ts` and `src/server/lib/social.ts`
    - _Requirements: 2.1, 2.4, 3.1, 10.3, 16.4_

  - [x] 11.2 Augment `src/server/routes/share.ts` — wire referral and share counters
    - After a successful `reddit.submitComment` in `shareScore`, call `trackShare(userId, date)` and `trackFunnelEvent('share', date)`
    - If the Reddit API call fails, still record the share counter (fire-and-forget)
    - _Requirements: 16.1, 16.4_

  - [x] 11.3 Augment `src/server/routes/submit.ts` — wire referred conversion tracking
    - After `recordDailyCompletion`, check if the user has a referral open recorded for today; if so, call `trackReferredConversion(userId, date)`
    - _Requirements: 16.3_

  - [x] 11.4 Mount `SocialPresence` and `ChallengePanel` in `src/client/App.svelte`
    - Import and render `SocialPresence` with the current `postId`
    - Import and render `ChallengePanel` (gated on authenticated user)
    - Import and render `AdminDashboard` with `isModerator` prop (fetch moderator status from context or a new `/api/user/is-moderator` endpoint)
    - _Requirements: 5.5, 11.2, 17.2, 17.3_

- [x] 12. Final checkpoint — Ensure all tests pass and types are clean
  - Run `pnpm test` to confirm all test suites pass; run `pnpm type-check` to confirm zero TypeScript errors; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The Redis mock pattern from `src/server/routes.growth.test.ts` should be extended (not duplicated) for new test files
- All new server functions must follow the existing pattern: small pure helpers + thin route handlers
- `formatMetricsAsMarkdown` lives in `src/shared/` so it can be called from both the client store and the server export route
- Polling intervals: social presence = 15s, pending challenges = 10s, active challenge = 3s
- No new npm packages are required — `fast-check` and `vitest` are already in devDependencies
- Property tests use `fast-check` (`fc`) already installed at `^4.8.0`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4"] },
    { "id": 1, "tasks": ["1.3", "1.5", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.2"] },
    { "id": 4, "tasks": ["3.3", "4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["4.3", "6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4"] },
    { "id": 8, "tasks": ["6.5"] },
    { "id": 9, "tasks": ["6.6", "7.1", "7.2", "7.3"] },
    { "id": 10, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 11, "tasks": ["9.3", "9.4", "10.5"] },
    { "id": 12, "tasks": ["9.5"] },
    { "id": 13, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 14, "tasks": ["11.4"] }
  ]
}
```
