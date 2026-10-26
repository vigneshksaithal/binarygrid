---
name: use-reddit-api
description: Interact with the Reddit API from server-side code. Use when reading user info, submitting posts/comments, setting flair, or accessing subreddit data.
---

# Use Reddit API

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Available imports

```typescript
import { reddit, context } from '@devvit/web/server'
```

## Context variables

| Variable | Type | Available when |
|----------|------|----------------|
| `context.userId` | `string \| undefined` | User is logged in |
| `context.postId` | `string \| undefined` | Inside a post |
| `context.subredditId` | `string` | Always |
| `context.subredditName` | `string` | Always |

Always guard optional context before use (see `api-route` skill for guard helpers).

## Common operations

### Get current user

```typescript
const user = await reddit.getCurrentUser()
if (!user) {
  return c.json({ status: 'error', message: 'Not logged in' }, 400)
}
const username = user.username
```

### Get current subreddit

```typescript
const subreddit = await reddit.getCurrentSubreddit()
```

### Submit a custom post

```typescript
const post = await reddit.submitCustomPost({
  subredditName: context.subredditName!,
  title: 'My Post Title',
  entry: 'default',  // matches entrypoint key in devvit.json
})
// post.id is the new post ID (e.g. "t3_abc")
```

### Submit a comment

```typescript
await reddit.submitComment({
  postId: context.postId!,
  text: 'Great job! 🎉',
})
```

### Set user flair

```typescript
await reddit.setUserFlair({
  subredditName: context.subredditName!,
  username: user.username,
  text: 'Champion 🏆',
})
```

### Navigation response (menu items)

When a menu item handler needs to redirect the user to a post:

```typescript
app.post('/internal/menu/create-game', async (c) => {
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName!,
    title: 'New Game',
    entry: 'default',
  })
  return c.json({
    navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
  })
})
```

## Constraints
- Reddit API calls are server-side only — never from client Svelte code
- 30-second request timeout applies to all operations
- Error handling follows the `api-route` skill pattern (try/catch, `instanceof Error`)
- `submitCustomPost()` no longer accepts the old `splash` or `loading` options; use a dedicated HTML entrypoint when the post needs a splash view.
- For wiki revisions on Devvit 0.15+, pass an options object to `reddit.getWikiPage(subredditName, pageName, options)`; the positional revision ID overload was removed. The two-argument call remains supported.
- Wiki v2 is not enabled for every subreddit. Check `reddit.isWikiV2Enabled()` before making v2 wiki calls, and prefer `revisionAuthorId` / `authorId` over the deprecated author fields.
- For moderation report details, use `modReports`; `modReportReasons` is deprecated.
- For newer Reddit API capabilities not shown here, such as post search or community highlights, check the Devvit docs matching the project's pinned version before choosing a method or signature.

## Checklist before finishing
- [ ] Tests written FIRST with Vitest beside the module under test; server tests mock `@devvit/web/server` with the shared fake in `src/server/test-helpers/devvit-fake.ts` (extend it instead of copying it)
- [ ] All Reddit API calls are in server code (`src/server/`)
- [ ] `context.userId` and `context.postId` guarded before use
- [ ] Response uses standard shape from `api-route` skill
- [ ] Menu item handlers return `{ navigateTo: url }` when redirecting
- [ ] `bun run test` passes with zero failures
