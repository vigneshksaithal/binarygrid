---
name: update-devvit-config
description: Modify devvit.json to add menu items, triggers, post entrypoints, or permissions. Use when wiring new server endpoints to Reddit UI actions.
---

# Update Devvit Config

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

Devvit 0.15 requires `devvit.json`; `devvit.yaml` is no longer supported. Post entrypoints are inline by default, so do not add the deprecated `inline` property.

## devvit.json structure

```jsonc
{
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
  "name": "app-name",
  "post": {
    "dir": "dist/client",
    "entrypoints": {
      "default": {
        "entry": "index.html", // relative to post.dir
        "height": "tall"       // "short" | "regular" | "tall"
      }
    }
  },
  "server": {
    "dir": "dist/server",
    "entry": "index.cjs"
  },
  "menu": { ... },
  "triggers": { ... },
  "dev": { ... }
}
```

## Adding a menu item

Menu items appear in Reddit's "..." menu on posts or subreddits. Each maps to an `/internal/menu/*` endpoint.

```json
{
  "menu": {
    "items": [
      {
        "label": "Human-readable label",
        "description": "Tooltip text",
        "location": "subreddit",
        "forUserType": "moderator",
        "endpoint": "/internal/menu/action-name"
      }
    ]
  }
}
```

| Field | Values | Notes |
|-------|--------|-------|
| `location` | `"subreddit"`, `"post"`, `"comment"` | Where the menu item appears |
| `forUserType` | `"moderator"`, `"member"` | Who can see it |
| `endpoint` | `/internal/menu/{name}` | Must match a Hono route |

The values shown here are an example, not the complete menu or trigger schema. Check the current Devvit configuration docs when adding fields or capabilities.

After adding a menu item, create the matching Hono handler:

```typescript
app.post('/internal/menu/action-name', async (c) => {
  // handler logic
  return c.json({ status: 'success', data: {} })
})
```

## Adding a trigger

Triggers fire on platform events. Each maps to an `/internal/*` endpoint.

```json
{
  "triggers": {
    "onAppInstall": "/internal/on-app-install",
    "onPostCreate": "/internal/on-post-create",
    "onCommentCreate": "/internal/on-comment-create"
  }
}
```

| Trigger | Fires when |
|---------|-----------|
| `onAppInstall` | App installed on a subreddit |
| `onAppUpgrade` | App updated to new version |
| `onPostCreate` | New post created in subreddit |
| `onCommentCreate` | New comment on any post |
| `onPostDelete` | Post deleted |
| `onCommentDelete` | Comment deleted |

This table is only a short list of common events. Consult Devvit's Trigger Event Catalog for the current event list, each event's payload shape, optional fields, and delivery behavior. Triggers may be delivered asynchronously or more than once, so handlers must be idempotent and should avoid recursive actions. Check the payload to ensure the app did not cause the event. Some events, including app-mention triggers, have limited access.

## Post height options

| Height | Pixels | Use case |
|--------|--------|----------|
| `"short"` | ~240px | Simple widgets, counters |
| `"regular"` | ~320px | Cards, small games |
| `"tall"` | ~512px | Full games, complex UI |

## Checklist before finishing
- [ ] Tests written FIRST with Vitest beside the corresponding server module; server tests use the shared fake from `src/server/test-helpers/devvit-fake.ts`
- [ ] Menu item `endpoint` matches a Hono route in `src/server/index.ts`
- [ ] Trigger endpoint matches a Hono route
- [ ] `location` and `forUserType` are appropriate for the action
- [ ] Endpoint path follows `/internal/menu/*` or `/internal/on-*` convention
- [ ] Corresponding server handler exists and handles errors
- [ ] `bun run test` passes with zero failures
