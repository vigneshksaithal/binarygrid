# Requirements Document

## Introduction

The Viral Social Engine transforms Binary Grid from a solo puzzle experience into a socially-driven, habit-forming game with measurable viral growth. This feature introduces five interconnected systems:

1. **Viral Analytics Engine** — K-factor calculation, retention cohort tracking, and conversion funnel measurement using storage-efficient Redis primitives (bitmaps, HyperLogLog, counters).
2. **Admin Metrics Dashboard** — A moderator-only panel displaying 14-day rolling viral metrics with sparkline visualizations and clipboard markdown export.
3. **Social Presence** — Real-time-feeling active player counts, recent solver avatars, and FOMO mechanics delivered via polling.
4. **1v1 Challenge System** — A polling-based challenge lifecycle (create → accept → race → result) with a Redis-backed state machine.
5. **Viral Growth Mechanics** — Behavioral psychology hooks (Hooked model, social proof, urgency/scarcity) wired into every touchpoint.

All features operate within Devvit's serverless constraints: Redis-only storage, no WebSockets, and the existing permission set (`redis`, `SUBSCRIBE_TO_SUBREDDIT`, `SUBMIT_COMMENT`).

---

## Glossary

- **Viral_Analytics_Engine**: The server-side library (`src/server/lib/viral-analytics.ts`) responsible for tracking DAU bitmaps, HyperLogLog impressions, funnel counters, retention cohorts, and K-factor computation.
- **Challenge_System**: The server-side library (`src/server/lib/challenge.ts`) managing the 1v1 challenge lifecycle via a Redis-backed state machine.
- **Social_Presence_Engine**: The server-side library (`src/server/lib/social.ts`) providing active player counts, recent solver avatars, and social proof data.
- **Admin_Dashboard**: The Svelte component (`src/client/components/AdminDashboard.svelte`) rendering moderator-only viral metrics.
- **Admin_Server**: The Hono route handler for `/api/admin/*` endpoints, responsible for server-side moderator validation.
- **Metrics_Formatter**: The pure function `formatMetricsAsMarkdown` that serializes `DailyViralMetrics[]` into a markdown table string.
- **Metrics_Aggregator**: The function `aggregateMetrics` that reads Redis and assembles `DailyViralMetrics[]` for a requested date range.
- **Challenge_Client**: The Svelte component (`src/client/components/ChallengePanel.svelte`) and its polling logic.
- **Social_Presence_Client**: The Svelte component (`src/client/components/SocialPresence.svelte`) and its polling logic.
- **Viral_Growth_Engine**: The combined client and server logic that surfaces social proof, urgency cues, and referral tracking.
- **Challenge_State_Machine**: The state transition logic within the Challenge_System enforcing valid challenge lifecycle progressions.
- **Challenge_Result**: The computed outcome of a finished challenge, including winner, loser times, and margin.
- **Retention_Rate_Calculator**: The function `getRetentionRate` that computes the fraction of a cohort that returned on a given day offset.
- **DAU**: Daily Active Users — the count of unique users who opened the app on a given day, tracked via Redis bitmaps.
- **K-factor**: Viral coefficient computed as `(shares / DAU) × (referred_conversions / referred_opens)`. A value greater than 1 indicates viral growth.
- **Cohort**: A group of users who first opened the app on the same calendar date.
- **Funnel**: The ordered sequence of user actions: impression → open → start → complete → share → refer_open.
- **HyperLogLog**: A Redis probabilistic data structure used for approximate unique impression counting with less than 1% standard error.
- **Heartbeat**: A periodic signal sent by the client to record that a user is actively viewing or solving a puzzle.
- **FOMO**: Fear Of Missing Out — the psychological trigger created by showing active player counts and recent solver activity.

---

## Requirements

### Requirement 1: Viral Analytics — DAU and Impression Tracking

**User Story:** As a game operator, I want to track daily active users and post impressions accurately and efficiently, so that I can measure the game's reach without exceeding Redis storage budgets.

#### Acceptance Criteria

1. WHEN a user opens the app, THE Viral_Analytics_Engine SHALL set the user's bit in the daily DAU bitmap key `viral:dau:{dateISO}` using the user's stable bit index.
2. THE Viral_Analytics_Engine SHALL assign each user a unique, stable bit index stored permanently in the `viral:user-index` hash, such that the same userId always maps to the same index.
3. WHEN a user opens the app for the first time and no bit index exists for that user, THE Viral_Analytics_Engine SHALL atomically allocate the next available index using `viral:user-index:counter` and persist the mapping; subsequent app opens SHALL reuse the existing index without allocating a new one.
4. WHEN a post impression is recorded, THE Viral_Analytics_Engine SHALL add the postId to the HyperLogLog key `viral:impressions:{dateISO}` using PFADD.
5. THE Viral_Analytics_Engine SHALL apply TTLs to all Redis keys according to the following policy: funnel counter keys (`viral:funnel:{dateISO}:*`) — 60 days; daily event counter keys (`viral:daily:{dateISO}:*`) — 60 days; HyperLogLog impression keys (`viral:impressions:{dateISO}`) — 60 days; retention cohort bitmap keys (`viral:retention:d{N}:{cohortDate}`) — 90 days; DAU bitmap keys (`viral:dau:{dateISO}`) — 60 days.
6. THE Viral_Analytics_Engine SHALL reject any TTL value that does not exactly match the specified retention period for the key type.

---

### Requirement 2: Viral Analytics — Funnel Event Tracking

**User Story:** As a game operator, I want to track each stage of the player acquisition funnel, so that I can identify where users drop off and optimize conversion.

#### Acceptance Criteria

1. WHEN a funnel event of type `impression`, `open`, `start`, `complete`, `share`, or `refer_open` is recorded, THE Viral_Analytics_Engine SHALL increment the counter at `viral:funnel:{dateISO}:{eventType}` by 1.
2. WHEN a user opens the app via a referral link, THE Viral_Analytics_Engine SHALL increment `viral:daily:{dateISO}:referred_opens` by 1.
3. WHEN a referred user completes a puzzle, THE Viral_Analytics_Engine SHALL increment `viral:daily:{dateISO}:referred_converts` by 1.
4. WHEN a user shares their score, THE Viral_Analytics_Engine SHALL increment `viral:daily:{dateISO}:shares` by 1.
5. THE Viral_Analytics_Engine SHALL require authentication for all viral tracking activities, including funnel events, referral opens, puzzle completions, and score shares, associating each event with the authenticated user's ID.

---

### Requirement 3: Viral Analytics — Retention Cohort Tracking

**User Story:** As a game operator, I want to measure D1, D7, and D30 retention rates for each daily cohort, so that I can evaluate whether the game creates lasting habits.

#### Acceptance Criteria

1. WHEN a user opens the app for the first time, THE Viral_Analytics_Engine SHALL record their cohort date in `viral:user-cohorts` as the current ISO date.
2. WHEN a user opens the app exactly 1 day after their cohort date, THE Viral_Analytics_Engine SHALL set the user's bit in `viral:retention:d1:{cohortDate}`.
3. WHEN a user opens the app exactly 7 days after their cohort date, THE Viral_Analytics_Engine SHALL set the user's bit in `viral:retention:d7:{cohortDate}`.
4. WHEN a user opens the app exactly 30 days after their cohort date, THE Viral_Analytics_Engine SHALL set the user's bit in `viral:retention:d30:{cohortDate}`.
5. THE Retention_Rate_Calculator SHALL return a value in the range [0, 1] representing the fraction of a cohort that returned on the specified day offset, regardless of calculation order.
6. IF a cohort has zero users, THEN THE Retention_Rate_Calculator SHALL return exactly 0, preventing any division-by-zero errors.
7. THE Viral_Analytics_Engine SHALL allow retention tracking for cohorts that have zero users, creating the data structures as needed.

---

### Requirement 4: Viral Analytics — K-Factor Computation

**User Story:** As a game operator, I want to compute the daily K-factor, so that I can know whether the game is growing virally and track the effectiveness of sharing mechanics.

#### Acceptance Criteria

1. THE Viral_Analytics_Engine SHALL compute K-factor using the formula: `K = (shares / DAU) × (referred_conversions / referred_opens)`.
2. IF DAU is 0, THEN THE Viral_Analytics_Engine SHALL return a K-factor of 0.
3. IF referred_opens is 0, THEN THE Viral_Analytics_Engine SHALL return a K-factor of 0.
4. THE Viral_Analytics_Engine SHALL return a K-factor value that is always greater than or equal to 0.
5. WHEN K-factor exceeds 1.0, THE Viral_Analytics_Engine SHALL indicate viral growth conditions in the returned metrics, based purely on the K-factor value regardless of whether the underlying sharing metrics are all zero.

---

### Requirement 5: Admin Metrics Dashboard — Display

**User Story:** As a subreddit moderator, I want to view 14-day rolling viral metrics in a dedicated dashboard, so that I can monitor game health and growth without needing external analytics tools.

#### Acceptance Criteria

1. WHEN a moderator opens the admin panel, THE Admin_Dashboard SHALL fetch metrics from `GET /api/admin/metrics?days=14` and display the results.
2. THE Admin_Dashboard SHALL display KPI cards for DAU, K-factor, share rate, D1 retention, and D7 retention; WHEN the metrics fetch fails, THE Admin_Dashboard SHALL show empty KPI cards rather than hiding them.
3. THE Admin_Dashboard SHALL render sparkline visualizations for each KPI using pure inline SVG without any external chart library dependency.
4. THE Admin_Dashboard SHALL display a conversion funnel visualization showing the counts for each funnel stage: impression, open, start, complete, share, and refer_open.
5. THE Admin_Dashboard SHALL only render when the `isModerator` prop is `true`, regardless of other conditions such as fetch failures.
6. WHILE the metrics are loading, THE Admin_Dashboard SHALL display a loading state to the moderator.
7. IF the metrics fetch fails, THEN THE Admin_Dashboard SHALL display an error message to the moderator.

---

### Requirement 6: Admin Metrics Dashboard — Access Control

**User Story:** As a subreddit moderator, I want the admin dashboard to be protected from non-moderator access, so that sensitive growth data is not exposed to regular players.

#### Acceptance Criteria

1. THE Admin_Server SHALL validate moderator status server-side using the Devvit context before returning any metrics data; IF server-side validation is disabled or fails, THEN THE Admin_Server SHALL block all access by default.
2. IF a non-moderator user requests `GET /api/admin/metrics`, THEN THE Admin_Server SHALL return a 403 Forbidden response.
3. IF a non-moderator user requests `GET /api/admin/metrics/export`, THEN THE Admin_Server SHALL return a 403 Forbidden response.
4. THE Admin_Dashboard SHALL treat client-side moderator gating as cosmetic only; THE Admin_Server SHALL enforce access control independently.

---

### Requirement 7: Admin Metrics Dashboard — Clipboard Export

**User Story:** As a subreddit moderator, I want to copy the 14-day metrics as a formatted markdown table, so that I can paste them into Reddit posts, Discord, or reports without manual formatting.

#### Acceptance Criteria

1. WHEN a moderator clicks the "Copy to Clipboard" button, THE Admin_Dashboard SHALL call `formatMetricsAsMarkdown` with the current 14-day metrics and write the result to the system clipboard using `navigator.clipboard.writeText`.
2. THE Metrics_Formatter SHALL produce a markdown string that includes a header row with columns: Date, DAU, K-Factor, Share Rate, D1 Ret, D7 Ret, Conversions, and Challenges.
3. THE Metrics_Formatter SHALL include a markdown separator row immediately after the header row.
4. THE Metrics_Formatter SHALL include one data row per day in the metrics array.
5. THE Metrics_Formatter SHALL include a summary section after the data rows containing average DAU, average K-factor, average share rate, total challenges completed, and the best day by K-factor; WHEN no metrics data is available, THE Metrics_Formatter SHALL display "No data available" for each summary field rather than omitting the section.
6. THE Metrics_Formatter SHALL format K-factor values to 3 decimal places.
7. THE Metrics_Formatter SHALL format share rate, D1 retention, and D7 retention as percentages to 1 decimal place.

---

### Requirement 8: Metrics Aggregation

**User Story:** As a game operator, I want the metrics aggregation to be complete and consistent, so that the admin dashboard always shows accurate data even for days with no activity.

#### Acceptance Criteria

1. WHEN `aggregateMetrics(N)` is called, THE Metrics_Aggregator SHALL return exactly N `DailyViralMetrics` entries.
2. THE Metrics_Aggregator SHALL return entries ordered from most recent date to oldest date.
3. IF no Redis data exists for a given date, THEN THE Metrics_Aggregator SHALL return 0 for all numeric fields on that date rather than null or undefined.
4. THE Metrics_Aggregator SHALL compute `shareRate` as `shares / DAU` for each day; WHEN both shares and DAU are 0, THE Metrics_Aggregator SHALL return a shareRate of 0.
5. THE Metrics_Aggregator SHALL compute `conversionRate` as `referred_conversions / referred_opens` for each day, defaulting to 0 when referred_opens is 0.
6. THE Metrics_Aggregator SHALL include D1, D7, and D30 retention rates for each day's cohort in the returned metrics.

---

### Requirement 9: Social Presence — Active Player Tracking

**User Story:** As a player, I want to see how many other players are currently solving the puzzle, so that I feel part of an active community and am motivated to play.

#### Acceptance Criteria

1. WHEN a user sends a heartbeat, THE Social_Presence_Engine SHALL add or update the user's entry in the sorted set `social:active:{postId}` with the current Unix timestamp as the score.
2. WHEN a heartbeat is recorded, THE Social_Presence_Engine SHALL remove all entries from `social:active:{postId}` with a score older than 5 minutes.
3. THE Social_Presence_Engine SHALL return the count of entries remaining in `social:active:{postId}` after pruning as the active player count; WHEN entries exist in the window, THE Social_Presence_Engine SHALL return the actual count of those entries.
4. WHEN the active players sorted set contains no entries within the 5-minute window, THE Social_Presence_Engine SHALL return an active player count of 0, regardless of any cached data.
5. THE Social_Presence_Engine SHALL set a 24-hour TTL on the `social:active:{postId}` key for automatic cleanup.

---

### Requirement 10: Social Presence — Recent Solvers and Social Proof

**User Story:** As a player, I want to see the avatars and usernames of recent solvers, so that I feel social pressure and motivation to complete the puzzle myself.

#### Acceptance Criteria

1. THE Social_Presence_Engine SHALL return up to 5 of the most recently active player avatars with their usernames.
2. THE Social_Presence_Engine SHALL return the total number of players who solved the puzzle today from the `social:solvecount:{dateISO}` counter, displaying the actual count even when it is 0.
3. WHEN a user completes a puzzle, THE Social_Presence_Engine SHALL increment `social:solvecount:{dateISO}` by 1.
4. THE Social_Presence_Engine SHALL keep only the last 10 entries in the `social:solvers:{puzzleId}` sorted set using ZREMRANGEBYRANK.
5. THE Social_Presence_Engine SHALL return the count of pending challenge notifications for the authenticated user as part of the social proof data, displaying the actual count even when it is 0.
6. WHEN a user's avatar metadata is unavailable, THE Social_Presence_Engine SHALL substitute a default username of "Player" and a null avatar URL.

---

### Requirement 11: Social Presence — Client Polling

**User Story:** As a player, I want the social presence data to refresh automatically, so that the active player count and recent solvers stay current without requiring a manual page reload.

#### Acceptance Criteria

1. THE Social_Presence_Client SHALL poll `GET /api/social/presence` every 15 seconds to refresh social proof data.
2. THE Social_Presence_Client SHALL display the active player count and recent solver avatars to all users, including unauthenticated users.
3. WHILE the social presence data is loading for the first time, THE Social_Presence_Client SHALL display a placeholder state.
4. THE Social_Presence_Client SHALL stop polling when the component is unmounted to prevent memory leaks.

---

### Requirement 12: 1v1 Challenge System — Challenge Creation

**User Story:** As a player, I want to challenge another player to a head-to-head race on today's puzzle, so that I can compete directly with friends and add a competitive dimension to the game.

#### Acceptance Criteria

1. WHEN a user creates a challenge, THE Challenge_System SHALL create a challenge hash in Redis at `challenge:{challengeId}` with state `pending`, containing: challengerId, opponentId, challengerUsername, opponentUsername, puzzleId, and createdAt.
2. WHEN a challenge is created, THE Challenge_System SHALL set a 1-hour TTL on the challenge hash.
3. WHEN a challenge is created, THE Challenge_System SHALL add the challengeId to the opponent's pending inbox at `user:{opponentId}:challenges:pending` with a 1-hour TTL.
4. WHEN a challenge is created, THE Challenge_System SHALL set a deduplication lock at `challenge:active:{orderedPairKey}` with a 1-hour TTL to prevent duplicate challenges.
5. WHEN a challenge is created, THE Challenge_System SHALL increment `viral:daily:{dateISO}:challenges_sent` by 1.
6. IF a user attempts to challenge themselves, THEN THE Challenge_System SHALL return an error without creating any Redis state.
7. IF an active challenge already exists between two users, THEN THE Challenge_System SHALL return an error without creating a duplicate challenge.
8. IF the opponent username does not exist in `user:meta`, THEN THE Challenge_System SHALL return a 404 error with the message "User not found. They need to play at least one puzzle first."
9. THE Challenge_System SHALL enforce a rate limit of 5 pending challenges per user per hour.

---

### Requirement 13: 1v1 Challenge System — Challenge Acceptance

**User Story:** As a player, I want to accept or see incoming challenge requests, so that I can respond to friends who want to race me.

#### Acceptance Criteria

1. THE Challenge_Client SHALL poll `GET /api/challenge/pending` every 10 seconds to check for incoming challenges.
2. WHEN an opponent accepts a challenge, THE Challenge_System SHALL transition the challenge state from `pending` to `active` and record `startedAt` as the current ISO timestamp.
3. WHEN a challenge transitions to `active`, THE Challenge_System SHALL update the TTL on the challenge hash to 30 minutes.
4. WHEN a challenge is accepted, THE Challenge_System SHALL remove the challengeId from the opponent's pending inbox.
5. THE Challenge_System SHALL only allow the designated opponent to accept a pending challenge; any other user attempting to accept SHALL receive an error.

---

### Requirement 14: 1v1 Challenge System — Race and Completion

**User Story:** As a player in an active challenge, I want to race my opponent to solve the puzzle and see the result, so that I get a competitive outcome with clear win/loss feedback.

#### Acceptance Criteria

1. THE Challenge_Client SHALL poll `GET /api/challenge/{id}/status` every 3 seconds while a challenge is in the `active` state.
2. WHEN a player submits their solve time, THE Challenge_System SHALL record the time in the challenge hash under `challengerTime` or `opponentTime` based on the submitting user's role.
3. THE Challenge_System SHALL only allow challenge participants (challenger or opponent) to submit solve times.
4. WHEN both players have submitted their solve times, THE Challenge_System SHALL determine the winner as the player with the lower solve time and record only the winner's userId in the `winner` field.
5. WHEN both players have submitted their solve times, THE Challenge_System SHALL transition the challenge state to `finished` and record the winner userId and margin (absolute difference in seconds).
6. WHEN a challenge transitions to `finished`, THE Challenge_System SHALL increment `viral:daily:{dateISO}:challenges_completed` by 1.
7. THE Challenge_Result SHALL compute margin as the absolute difference between the challenger's and opponent's solve times.
8. WHEN a challenge finishes, THE Challenge_System SHALL add the result to both participants' challenge history lists at `user:{userId}:challenges:history`, trimmed to a maximum of 20 entries using LTRIM.

---

### Requirement 15: 1v1 Challenge System — State Machine and Expiry

**User Story:** As a player, I want stale or abandoned challenges to be cleaned up automatically, so that my challenge inbox does not fill up with expired requests.

#### Acceptance Criteria

1. THE Challenge_State_Machine SHALL only permit the following state transitions: `pending` → `active`, `pending` → `expired`, `active` → `finished`, `active` → `expired`.
2. IF a transition is attempted from a terminal state (`finished` or `expired`), THEN THE Challenge_State_Machine SHALL throw an error.
3. WHEN a pending challenge's 1-hour TTL elapses, THE Challenge_System SHALL treat the challenge as `expired`.
4. WHEN an active challenge's 30-minute TTL elapses, THE Challenge_System SHALL treat the challenge as `expired`.
5. WHEN a client polls for a challenge that is completely absent from Redis, THE Challenge_System SHALL return `{ state: 'expired', reason: 'timeout' }`; challenges that still exist in Redis SHALL return their current state regardless of TTL status.
6. THE Challenge_System SHALL maintain a history of the last 20 challenges per user; adding a 21st entry SHALL cause the oldest entry to be removed.

---

### Requirement 16: Viral Growth Mechanics — Referral Tracking

**User Story:** As a game operator, I want to track the full referral loop from share to conversion, so that I can measure the effectiveness of the viral sharing mechanic.

#### Acceptance Criteria

1. WHEN a user shares their score, THE Viral_Growth_Engine SHALL post a comment to the Reddit thread using the `SUBMIT_COMMENT` permission; IF the Reddit API call fails, THE Viral_Growth_Engine SHALL still record the share and increment the share counter.
2. WHEN a referred user opens the app, THE Viral_Growth_Engine SHALL detect the referral and increment the `referred_opens` counter for that day.
3. WHEN a referred user completes a puzzle on the same calendar day as their referral open, THE Viral_Growth_Engine SHALL increment the `referred_conversions` counter for that day; completions on subsequent days SHALL NOT be counted as conversions.
4. THE Viral_Growth_Engine SHALL associate each share with the sharer's userId in `viral:referrals:{userId}` for attribution tracking.

---

### Requirement 17: Viral Growth Mechanics — Social Proof and Urgency

**User Story:** As a player, I want to see social proof and urgency cues throughout the game, so that I feel motivated to play daily and share my results.

#### Acceptance Criteria

1. WHEN a user completes a puzzle, THE Viral_Growth_Engine SHALL display the total number of players who solved today's puzzle as social proof, showing the actual count even when it is 0.
2. THE Viral_Growth_Engine SHALL display the player's current streak status on the game screen to reinforce daily return behavior.
3. THE Viral_Growth_Engine SHALL surface pending challenge notifications to authenticated users as part of the social proof display.
4. WHEN a user has pending challenges, THE Viral_Growth_Engine SHALL display the count of pending challenges; the count SHALL be displayed even when it is 0 to confirm no pending challenges exist.

---

### Requirement 18: Input Validation and Security

**User Story:** As a system operator, I want all user-provided inputs to be validated before processing, so that the system is protected against malformed data and abuse.

#### Acceptance Criteria

1. THE Challenge_System SHALL validate that opponent usernames conform to Reddit username rules: alphanumeric characters and underscores only, maximum 20 characters.
2. THE Challenge_System SHALL validate that puzzleId matches the expected puzzle identifier format before creating a challenge.
3. THE Challenge_System SHALL validate that submitted solve times are positive finite numbers not exceeding 3600 seconds; a value of 0.0 seconds is permitted.
4. THE Admin_Server SHALL validate that the `days` query parameter for metrics requests is a positive integer.
5. IF any single input validation fails, THEN THE respective server handler SHALL return a 400 Bad Request response with a descriptive error message, regardless of whether other inputs are valid.

---

### Requirement 19: Storage Efficiency

**User Story:** As a system operator, I want the viral engine's Redis footprint to remain within budget, so that the game can scale to 10K DAU without exceeding storage limits.

#### Acceptance Criteria

1. THE Viral_Analytics_Engine SHALL use Redis bitmaps for DAU tracking, consuming approximately 1.25KB per 10,000 users per day.
2. THE Viral_Analytics_Engine SHALL use HyperLogLog for impression counting, consuming a fixed 12KB per day regardless of unique impression count.
3. THE Challenge_System SHALL bound challenge history to 20 entries per user using LTRIM, preventing unbounded list growth.
4. THE Social_Presence_Engine SHALL prune active player sorted set entries older than 5 minutes on every heartbeat write, preventing unbounded set growth.
5. THE Social_Presence_Engine SHALL keep only the last 10 entries in the recent solvers sorted set using ZREMRANGEBYRANK.
6. THE Viral_Analytics_Engine SHALL target a total Redis footprint of under 5MB per month at 10,000 DAU.
