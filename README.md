# Binary Grid (Devvit)

Daily 6×6 binary puzzle for Reddit/Devvit.

## Rules

- Each row/col has exactly three 0s and three 1s
- No three consecutive identical digits
- Respect fixed clues

## Tech

- Client: Svelte 5 + Tailwind
- Server: Hono (Devvit web server)
- Shared: TS modules
- Lint/Format: Biome
- Tests: Vitest

## Dev

```bash
pnpm install
pnpm dev
```

## API

- GET `/api/health` → `{ ok: true }`
- GET `/api/puzzle?date=YYYY-MM-DD&difficulty=easy|medium|hard` → `{ puzzle }`
- POST `/api/submit` body `{ id, grid }` → `{ ok: boolean, errors?: string[] }`

## Theming

- Toggle in toolbar (Dark/Light)
- Dark: black bg, green text; Light: white bg, green text

## Tests

```bash
pnpm test
```
