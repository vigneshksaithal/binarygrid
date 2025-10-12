# AGENTS.md

## Project Overview

Binary Grid is a daily 6×6 binary puzzle for Reddit/Devvit. Players fill a grid with 0s and 1s following specific rules: each row/column must have exactly 3 zeros and 3 ones, no three consecutive identical digits allowed, and fixed clues must be respected.

**Tech Stack:**

- Client: Svelte 5 + Tailwind CSS
- Server: Hono (Devvit web server)
- Shared: TypeScript modules
- Lint/Format: Biome + Ultracite
- Tests: Vitest
- Package Manager: PNPM

**Architecture:**

- Client webview (full-screen Reddit post)
- Serverless backend (Node.js)
- Shared types and validation logic
- Redis for persistence

## Setup Commands

- **Install dependencies:** `pnpm install`
- **Start dev server:** `pnpm dev` (runs client, server, and devvit playtest concurrently)
- **Build:** `pnpm build`
- **Run tests:** `pnpm test`
- **Type check:** `pnpm type-check`
- **Lint/format:** `pnpm fix` or `pnpm check:biome`
- **Deploy:** `pnpm deploy`
- **Publish:** `pnpm launch`

## Project Structure

```md
src/
├── client/          # Svelte 5 webview with Tailwind
├── server/          # Hono serverless backend (Node.js)
└── shared/         # Shared types and validation logic
dist/               # Build output (client + server)
```

## Code Style

- **Biome + Ultracite** for formatting/linting
- **Single quotes**, no semicolons (asNeeded)
- **Arrow functions** preferred
- **TypeScript strict mode**
- **Functional patterns** where possible
- **Prefer type aliases** over interfaces

## Development Guidelines

### Client Development

- Use `fetch(/api/endpoint)` to call server APIs
- Svelte 5 runes and modern patterns
- Terminal theme: dark/light with green accents
- Components in `/src/client/components/`
- Stores in `/src/client/stores/`

### Server Development

- Serverless Node.js (no fs, http, https, net, websockets, or streaming)
- Use Redis for persistence: `import { redis } from '@devvit/web/server'`
- API routes in `/src/server/routes.ts`
- Core logic in `/src/server/core/`

### Shared Code

- Types in `/src/shared/types/`
- Validation logic in `/src/shared/validator.ts`
- Game rules in `/src/shared/rules.ts`

## Testing

- **Vitest** for unit tests
- Test files: `*.test.ts`
- Run: `pnpm test`
- Coverage for validator, generator, routes
- Test location: alongside source files

## API Contracts

- **GET** `/api/health` → `{ ok: true }`
- **GET** `/api/puzzle` → `{ puzzle: PuzzleWithGrid }`
- **POST** `/api/submit` → `{ ok: boolean, errors?: string[] }`
- **POST** `/api/join-subreddit` → join current subreddit

## Game Rules

- **6×6 grid** with 0s and 1s
- **Each row/column:** exactly 3 zeros and 3 ones
- **No three consecutive** identical digits
- **Respect fixed clues** (cannot be changed)
- **Auto-submit** when complete and valid

## Important Constraints

- **No websockets** or HTTP streaming
- **Read-only filesystem** (serverless environment)
- **Use Redis** for state persistence
- **Web-compatible NPM dependencies** only
- **PNPM** for package management

## Devvit Specifics

- **Build outputs** to `dist/client` and `dist/server`
- **Post entry:** `dist/client/index.html`
- **Server entry:** `dist/server/index.cjs`
- **Dev subreddit:** `binarygrid`
- **Permissions:** Redis access, Reddit API access

## Development Workflow

1. **Start development:** `pnpm dev`
2. **Make changes** to client/server/shared code
3. **Run tests:** `pnpm test`
4. **Check types:** `pnpm type-check`
5. **Format code:** `pnpm fix`
6. **Build:** `pnpm build`
7. **Deploy:** `pnpm deploy`

## Troubleshooting

- **Build issues:** Check that all dependencies are web-compatible
- **Redis errors:** Ensure proper Redis connection in Devvit environment
- **Type errors:** Run `pnpm type-check` to identify issues
- **Test failures:** Check test files for proper mocking of Devvit APIs
