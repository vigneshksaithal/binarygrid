---
name: tdd
description: Test-Driven Development workflow using Vitest and the project's shared Devvit server fake. Use when writing any new feature, fixing bugs, or refactoring existing code.
---

# Test-Driven Development (TDD)

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## The cycle: Red → Green → Refactor

1. **Red** — Write a failing test that describes the desired behavior
2. **Green** — Write the minimal code to make the test pass
3. **Refactor** — Clean up while keeping tests green

Never write implementation code without a failing test first.

## Test runner: Vitest

```bash
bun run test              # run all tests once
bunx vitest --watch       # watch mode (not a package script)
```

For this repository, server tests mock `@devvit/web/server` with `src/server/test-helpers/devvit-fake.ts`. Extend that shared fake when a server test needs another Redis, Reddit, scheduler, or settings behavior; do not copy it or mix in a second fake. The fake models the Devvit 0.15 client behavior used by the app, and each test should reset it before use.

Devvit's `@devvit/test` package remains available, but Devvit 0.14 replaced its native Redis test server with a JavaScript implementation. Treat it as an in-memory test harness, not as a native Redis integration server. Follow this repository's shared-fake convention for server tests.

## File placement

```
src/
├── server/
│   ├── routes/
│   │   ├── puzzle.ts
│   │   └── puzzle.test.ts
│   └── test-helpers/
│       └── devvit-fake.ts
└── shared/
    ├── validator.ts
    └── validator.test.ts
```

Test files: `*.test.ts` — colocated next to the module under test where practical, following the existing repository structure.

## Server test setup

```typescript
import { beforeEach, expect, it, vi } from 'vitest'
import { context, reddit, redis } from '@devvit/web/server'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)

vi.mock('@devvit/web/server', () => fake)

beforeEach(() => fake.reset())
```

The helper path above is for tests one directory below `src/server`; adjust the relative path when the test is elsewhere. Keep the same shared fake and its reset controls.

Server tests use the mocked module just like production code:

```typescript
it('stores and retrieves data', async () => {
  await redis.set('key', 'value')
  const result = await redis.get('key')
  expect(result).toBe('value')
})
```

Use `fake.setSettings(...)`, `fake.snapshot()`, and `fake.ttlOf(key)` for installed settings, write-safety assertions, and recorded TTLs. The fake does not advance time or enforce TTL expiry; delete keys directly when a test needs to model expiration.

## Testing Hono routes

Use `app.request()` — no server startup needed:

```typescript
import { app } from '../index'

it('POST /api/my-route returns success', async () => {
  const res = await app.request('/api/my-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' }),
  })
  expect(res.status).toBe(200)
})
```

## Testing Redis patterns

The shared fake supports the Redis operations currently used by this app, including strings, hashes, sorted sets, counters, and TTL recording:

```typescript
it('leaderboard sorted set', async () => {
  await redis.zAdd('leaderboard', { member: 'alice', score: 100 })
  await redis.zAdd('leaderboard', { member: 'bob', score: 200 })
  const top = await redis.zRange('leaderboard', 0, 1, { by: 'rank', reverse: true })
  expect(top.map((e) => e.member)).toEqual(['bob', 'alice'])
})
```

## Mocking Reddit API

Use `vi.spyOn` for Reddit API calls:

```typescript
it('submits a post', async () => {
  vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc' } as never)
  const result = await myFunction()
  expect(reddit.submitCustomPost).toHaveBeenCalledWith({
    subredditName: context.subredditName, title: 'My Post', entry: 'default',
  })
})
```

## Seeding test data

Use `vi.spyOn` on the shared fake's Reddit methods for call assertions and resolved values. Use the fake's backing stores or controls when a test needs to seed supported data; extend the shared helper for reusable behavior.

## What to test

| Layer | What to test | Mocking approach |
|-------|-------------|-----------------|
| `shared/` | Pure logic, validators, parsers | None needed |
| `server/lib/` | Business logic, Redis patterns | Shared Devvit fake |
| `server/routes/` | HTTP status, response shape, errors | `app.request()` + shared fake |
| `client/*.ts` | Extracted logic (not .svelte) | Standard Vitest mocks |

## TDD rules

1. Write the test first
2. One assertion per behavior
3. Descriptive test names — `'returns 400 when guess exceeds max length'`
4. Test behavior, not internals
5. Reset the shared fake before each server test; keep pure-function tests independent of Devvit mocks
6. `bun run test` must pass before committing

## Checklist before finishing
- [ ] Tests written BEFORE implementation code
- [ ] All edge cases covered (undefined, empty, invalid input)
- [ ] Error paths tested (throws, rejects, error responses)
- [ ] Test names describe behavior, not implementation
- [ ] Server tests use the shared fake; no duplicate Devvit mock implementations are added
- [ ] `bun run test` passes with zero failures
