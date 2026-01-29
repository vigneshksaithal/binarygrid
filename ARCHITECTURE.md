# Architecture Overview

This document gives a concise view of Binary Grid’s architecture so agents and developers can navigate the codebase and contribute effectively. Update it as the codebase evolves.

## 1. Project Structure

The app is a **Devvit (Reddit) app**: a serverless backend and a client that runs inside a Reddit Custom Post webview. There is no separate `frontend/` or `backend/` tree; everything lives under `src/` with clear layers.

```text
[Project Root]/
├── src/
│   ├── client/                 # Svelte UI (runs in Reddit post webview)
│   │   ├── components/         # Reusable Svelte components (Grid, Cell, Modals, etc.)
│   │   ├── stores/             # Client state (game, timer, leaderboard, ui, hint, rank)
│   │   ├── app.css             # Global styles (Tailwind)
│   │   ├── App.svelte          # Root component
│   │   ├── main.ts             # Entry point
│   │   ├── index.html          # HTML entry (referenced by devvit.json)
│   │   └── vite.config.ts      # Vite build for client
│   ├── server/                 # Hono API (Devvit serverless)
│   │   ├── core/               # Puzzle generation, post creation
│   │   │   ├── generator.ts    # Daily puzzle generation (date + difficulty)
│   │   │   ├── generator.test.ts
│   │   │   └── post.ts         # Create/crosspost Reddit posts, store puzzles in Redis
│   │   ├── index.ts            # Hono app, internal endpoints, server bootstrap
│   │   ├── routes.ts           # Public API routes (puzzle, submit, leaderboard, etc.)
│   │   └── vite.config.ts      # Build for server
│   └── shared/                 # Framework-agnostic code (client + server + tests)
│       ├── types/              # Shared TypeScript types
│       │   ├── puzzle.ts       # Grid, Cell, Difficulty, Puzzle, PuzzleWithGrid
│       │   └── leaderboard.ts  # LeaderboardEntry, LeaderboardResponse
│       ├── rules.ts            # Puzzle rules (balance, no three-in-a-row)
│       ├── solver.ts           # Puzzle solver logic
│       ├── validator.ts        # Grid validation (respects fixed cells)
│       ├── solver.test.ts
│       └── validator.test.ts
├── assets/                     # Icons, splash (devvit.json media dir)
├── tools/                      # Shared TS config (e.g. tsconfig-base.json)
├── devvit.json                 # Devvit app config (post entrypoints, server, Redis, triggers, scheduler)
├── package.json
├── CHANGELOG.md
├── AGENTS.md                   # Conventions, stack, workflows
└── architecture.md             # This document
```

## 2. High-Level System Diagram

```text
[User] → [Reddit] → [Custom Post → Webview (Client/Svelte)]
                              |
                              | fetch(/api/…)
                              v
                    [Devvit Server (Hono)]
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
        [Redis]        [Reddit API]    [Devvit context]
        puzzles        comments,       postId, userId,
        leaderboards   avatars,        subredditName
        play counts    subscribe
```

- **User** opens a Binary Grid post on Reddit; the post’s webview loads the built client (`dist/client`).
- **Client** (Svelte) calls the app’s server via relative `fetch('/api/…')`; Devvit serves the app’s server from the same origin.
- **Server** (Hono) uses **Redis** for puzzles, leaderboards, play counts, and join status; **Reddit API** (via Devvit) for posts, comments, avatars, and subscriptions; **Devvit context** for `postId`, `userId`, `subredditName`.
- **Scheduler** (cron in `devvit.json`) hits `/internal/schedule/daily` to create the daily post (and optionally crosspost).

## 3. Core Components

### 3.1. Client (Svelte)

**Name:** Binary Grid Webview (Client)

**Description:** The UI that runs inside a Reddit Custom Post. It loads the daily puzzle (or puzzle for current post), lets the user fill the grid with 0/1, checks rules (balance, no three consecutive, fixed cells), runs a timer, and submits solutions. It also shows leaderboards, how-to-play, and success state.

**Technologies:** Svelte 5 (runes), TypeScript, Tailwind CSS v4, Lucide Svelte, Vite.

**Deployment:** Built to `dist/client`; Devvit serves it as the post’s entrypoint (inline, tall height). No separate hosting.

### 3.2. Server (Hono on Devvit)

**Name:** Binary Grid API (Server)

**Description:** Serverless Hono app that: serves puzzle by `postId` + difficulty (or date + difficulty with caching), validates and stores submissions, updates leaderboards and play counts, handles join-subreddit and comment-score, and exposes health. Internal endpoints create posts (on install, menu, daily schedule) and optionally crosspost.

**Technologies:** Hono, TypeScript, Devvit `@devvit/web/server` (Redis, Reddit, context, cache).

**Deployment:** Devvit serverless; entry `dist/server/index.cjs`. No filesystem writes; no WebSockets.

### 3.3. Shared

**Name:** Shared logic and types

**Description:** Types (`puzzle`, `leaderboard`), rules, solver, and validator used by client, server, and tests. Must stay framework-agnostic and side-effect-free so it can run in both environments and under Vitest.

**Technologies:** TypeScript only (no Svelte/Node/Devvit imports).

## 4. Data Stores

### 4.1. Redis (Devvit-managed)

**Name:** App Redis

**Type:** Redis (provided by Devvit).

**Purpose:** Store puzzles per post, leaderboards per puzzle, play counts, submission idempotency, and whether the user has joined the subreddit. All game and session state that must persist lives here.

**Key key patterns:**

- `post:{postId}:puzzle:{difficulty}` — Hash: puzzle id, size, difficulty, fixed, initial (grid).
- `leaderboard:{puzzleId}` — Sorted set: score = solve time seconds, member = userId.
- `leaderboard:{puzzleId}:meta` — Hash: userId → JSON `{ username, avatarUrl }`.
- `submission:{postId}:{puzzleId}` — Idempotency for submissions.
- `playCount:{postId}` — Integer count of plays.
- `user:{userId}:joined_subreddit` — Flag that user joined subreddit.
- `puzzle:cache:{date}:{difficulty}` — Server cache for daily puzzle when no postId (see routes).

## 5. External Integrations / APIs

**Reddit (via Devvit):** Submit/crosspost posts, submit comments (e.g. “I solved today’s puzzle…”), get current user/username, snoovatar URLs, subscribe to subreddit. All through `reddit` and `context` from `@devvit/web/server`.

**Devvit:** Context (`postId`, `userId`, `subredditName`), Redis, cache helper, server bootstrap. No direct external HTTP APIs beyond what Devvit/Reddit expose.

## 6. Deployment & Infrastructure

**Platform:** Reddit Devvit (serverless).

**Key aspects:** Client built to `dist/client`; server to `dist/server` with entry `index.cjs`. `devvit.json` defines post entrypoints, server dir, Redis permission, Reddit permissions (e.g. submit comment, subscribe), on-app-install trigger, menu “Create a new Game”, and scheduler for daily post (cron `0 14 * * *` → `/internal/schedule/daily`).

**CI/CD:** Not specified in repo (e.g. Dependabot in `.github/dependabot.yml`). Deploy is via Devvit tooling.

**Monitoring & logging:** Serverless environment; avoid reliance on long-lived processes or filesystem. Use Devvit’s logging where available.

## 7. Security Considerations

**Authentication / Identity:** Devvit provides `userId` in context when the user is logged in; no app-level auth. Unauthenticated users can play; submit/leaderboard/comment endpoints require `userId` where needed.

**Authorization:** Server checks `postId` and `userId` from context for submissions and comments. No RBAC; permissions are scoped by Reddit/Devvit (e.g. asUser: SUBSCRIBE_TO_SUBREDDIT, SUBMIT_COMMENT).

**Data:** Validate all request bodies (e.g. grid, solveTimeSeconds, difficulty) using shared validator and type checks. Puzzle ID is validated so submissions are checked against the correct puzzle.

**Client:** No secrets in client; no `localStorage` (per AGENTS.md). All persistent state is on the server (Redis) or Reddit.

## 8. Development & Testing Environment

**Local setup:** `pnpm install`, `pnpm dev` (see AGENTS.md). Dev subreddit can be set in `devvit.json` under `dev.subreddit`.

**Testing:** Vitest. Tests colocated (e.g. `generator.test.ts`, `solver.test.ts`, `validator.test.ts`). Shared and server code tested in Node; client tests can use browser if configured.

**Code quality:** Biome (lint + format). Run `pnpm type-check`, `pnpm test`, `pnpm fix` before committing.

## 9. Future Considerations / Roadmap

- Keep shared logic pure and well-tested when adding new puzzle variants or rules.
- Any new persistence should go through Redis; no SQL or file storage in this runtime.
- Leaderboard and play-count behaviour is best-effort where non-critical (e.g. play count failures do not break puzzle load).

## 10. Project Identification

**Project Name:** Binary Grid

**Repository:** (Set repository URL locally if needed.)

**Description:** Daily 6×6 binary logic puzzle on Reddit (Devvit). One post per day (or per manual create); three difficulties per post; leaderboard and optional comment sharing.

**Date of last update:** 2026-01-26

## 11. Glossary / Acronyms

- **Devvit:** Reddit’s app platform for building custom experiences (posts, servers, Redis, triggers, scheduler).
- **Custom Post:** A Reddit post type that loads an app-defined webview (here, the Svelte client).
- **Fixed cells / clues:** Pre-filled 0 or 1 cells that the player must not change.
- **Grid:** 6×6 matrix of values `0 | 1 | null` (empty cell).
- **Puzzle ID:** Identifies a puzzle instance (e.g. `{postId}:{difficulty}` or `{dateISO}:{difficulty}` for cached daily).
- **Solve time:** Seconds from puzzle load to valid submit; used for leaderboard and optional comment.
