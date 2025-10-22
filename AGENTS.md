# AGENTS.md

## Project Overview

Binary Grid is a daily 6×6 logic puzzle game, where players fill a grid with 0s and 1s following three core rules: each row and column must contain exactly three 0s and three 1s, no three consecutive identical digits are allowed, and players must respect pre-filled clue cells.

## Tech Stack

### Frontend

- [Devvit](https://developers.reddit.com/docs/) (version 0.12.1) - Reddit App Platform
- [Svelte](https://svelte.dev/) (version 5, runes) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Programming language
- [Tailwind CSS](https://tailwindcss.com/) (version 4) - CSS framework

### Backend

- [Hono JS](https://hono.dev/) - Backend framework
- [Redis](https://redis.io/) - Database
- [TypeScript](https://www.typescriptlang.org/) - Programming language

### Testing

- [Vitest](https://vitest.dev/) - Testing framework
- [Google Chrome](https://www.google.com/chrome/) - Browser

### Tools

- [Vite](https://vite.dev/) - Build tool
- [pnpm](https://pnpm.io/) - Package manager
- [Biome JS](https://biomejs.dev) - Linter and formatter
- [Ultracite](https://www.ultracite.ai) - Linter and formatter

> IMPORTANT NOTE:
> For Svelte use v5 runes syntax ONLY.
> For Tailwind CSS use v4 syntax ONLY.
> For Devvit the full docs are available at /docs/devvit-docs.txt

---

## File Structure

```text
assets/  // Public assets (images, sprites, audio, fonts)
docs/  // Project and Devvit documentation
dist/  // Build output
src/
  client/  // Svelte frontend. To persist data and access the server, call `fetch(/my/api/endpoint)`. This is how you get access to the APIs you write in /src/server.
    components/  // Reusable Svelte components
    index.html  // Entry point
  server/  // External API service (Hono). A serverless backend written in Node.js. This is where you can access redis and save data.
  shared/  // This is where you can place code that is to be shared between the devvit app, client, and server and the webview. It's a great place for shared types.
devvit.json  // Devvit config
```

---

## Guiding Principles

- Clarity and Reuse: Every component and page should be modular and reusable. Avoid duplication by factoring repeated UI patterns into components.
- Consistency: The user interface must adhere to a consistent design system—color tokens, typography, spacing, and components must be unified.
- Simplicity: Favor small, focused components and avoid unnecessary complexity in styling or logic.
- Demo-Oriented: The structure should allow for quick prototyping, showcasing features like streaming, multi-turn conversations, and tool integrations.
- Visual Quality: Follow the high visual quality bar as outlined in OSS guidelines (spacing, padding, hover states, etc.)

---

## Setup Commands

```zsh
pnpm install # install dependencies
pnpm dev # start the development server
pnpm build # build the project
pnpm test # run tests
pnpm type-check # check types
pnpm fix # format and lint code
```

---

## Code Style

### General

- Use strict TypeScript with ES modules.
- Omit semicolons unless syntactically required.
- Use functional programming patterns where possible.
- Arrow functions preferred.
- Keep imports sorted by package, shared modules, then relative paths.
- Avoid default exports; prefer named exports for tree-shaking.

### Svelte

- Svelte components must be PascalCase filenames, export props via the `$props()` rune, and keep markup declarative.
- Favor Tailwind utility classes and existing design tokens.
- Create reusable components in `src/client/components` before duplicating markup.

- Server handlers should be small pure functions registered on the shared `Hono` instance.
- Validate external input with `src/shared/validator.ts` helpers before mutating state.

### Shared

- Shared utilities should remain framework-agnostic. Write deterministic, side-effect-free functions wherever possible so they can be exercised from both client and server tests.

- When adding tests, colocate Vitest files using the `*.test.ts` suffix next to the module under test (e.g. `streak.test.ts`, `validator.test.ts`). Use lightweight fakes instead of hitting live services.

### Server

- This is a serverless node.js environment, you have all node globals at your disposal except: fs, http, https, and net.

- Instead of http or https, prefer fetch.
- You cannot write files as you are running on a read only file system.
- Do not install any libraries that rely on these to function.
- Websockets are not supported.
- HTTP streaming is not supported.
- Redis is accessible from `import { redis } from '@devvit/web/server'`.

### Devvit

When building these experiences, people will refer to the "devvit app" ([/src/devvit](mdc:src/devvit)) and "client" ([/src/client](mdc:src/client)).

> IMPORTANT NOTE:
> As this is a serverless runtime (akin to AWS Lambda), do not try to run SQLite or stateful in memory processes. For realtime use cases, consult the docs with devvit_search to learn more about the realtime service you can use.

---

## Development Workflow

### #1. Explore → Plan → Code → Commit

- First read code (don’t code yet).
- Think harder and plan.
- Ask questions if unclear. Don’t assume.
- Break down tasks into smaller steps.
- Ask user to approve plan before coding.
- Review plan → approve → code → verify → commit.

### #2. Test-First Workflow (TDD)

- Write tests first, confirm they fail.
- Implement and iterate until green.
- Verify no overfitting.

### #3. Start development

- Start development by running `pnpm dev`.
- Make changes to client/server/shared code.
- Run tests by running `pnpm test`.
- Check types by running `pnpm type-check`.
- Format & lint code by running `pnpm fix`.

---

## Git Workflows

- Follow conventional commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.) with subjects ≤ 72 characters. Include context in the body when non-trivial decisions are made.
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
- Default merge method: rebase
- Avoid force-push to main

- Commit messages:
  - Follow conventional commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.) with subjects ≤ 72 characters. Include context in the body when non-trivial decisions are made.
  - Start with an imperative verb.
  - Example: `feat(auth): add token validation`
  - Always typecheck before committing.

## Repository Etiquette

- Keep commits small and descriptive.
- Update AGENTS.md with every new workflow or major tool.
- Never commit secrets or local settings.
