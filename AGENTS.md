# AGENTS.md

## Project Overview

Binary Grid is a daily 6×6 logic puzzle game. Players fill a grid with 0s and 1s according to three rules:

1. Each row and column must contain exactly three 0s and three 1s.
2. No three consecutive identical digits are allowed.
3. Players must respect pre-filled clue cells.

## Tech Stack

### Frontend

- [Devvit](https://developers.reddit.com/docs/) (v0.12.1) — Reddit App Platform
- [Svelte](https://svelte.dev/) (v5, runes) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — Programming language
- [Tailwind CSS](https://tailwindcss.com/) (v4) — CSS framework
- [Lucide Svelte](https://lucide.dev/) — Icon library

>**IMPORTANT NOTE:**
>For Lucide Icons use `@lucide/svelte/icons/{icon-name}` imports to enable tree-shaking.

### Backend

- [Hono JS](https://hono.dev/) — Backend framework
- [Redis](https://redis.io/) — Database
- [TypeScript](https://www.typescriptlang.org/) — Programming language

### Testing

- [Vitest](https://vitest.dev/) — Testing framework
- [Google Chrome](https://www.google.com/chrome/) — Browser

### Tools

- [Vite](https://vite.dev/) — Build tool
- [pnpm](https://pnpm.io/) — Package manager
- [Biome JS](https://biomejs.dev) — Linter and formatter
- [Ultracite](https://www.ultracite.ai) — Linter and formatter

> **IMPORTANT NOTE:**
>
> - Use Svelte v5 runes syntax ONLY.
> - Use Tailwind CSS v4 syntax ONLY.

---

## MCP Servers

### Svelte MCP Server: Available Tools

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively.

#### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

#### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

#### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

#### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

### Devvit MCP Server: Available Tools

You are able to use the Devvit MCP server, where you have access to comprehensive Devvit documentation. Here's how to use the available tools effectively.

#### 1. devvit_search

Executes search over all of Devvit documentation. This is preferable to pasting in tons of docs since it can be more specific and lowers the risk of polluting your context.

## File Structure

```text
assets/           # Public assets (images, sprites, audio, fonts)
dist/             # Build output
src/
  client/         # Svelte frontend; use `fetch(/my/api/endpoint)` to access server APIs in `/src/server`
    components/   # Reusable Svelte components
    index.html    # Entry point
  server/         # Hono external API service (serverless backend in Node.js, with Redis access)
  shared/         # Shared code for devvit app, client, server, and webview (e.g., shared types)
devvit.json       # Devvit config
```

---

## Guiding Principles

- Clarity and Reuse: Make every component and page modular and reusable; abstract repeated UI patterns into components.
- Consistency: Maintain a unified design system (color tokens, typography, spacing, components).
- Simplicity: Prefer small, focused components and avoid unnecessary complexity.
- Demo-Oriented: Enable quick prototyping to showcase streaming, multi-turn conversations, and tool integrations.
- Visual Quality: Uphold a high standard of visual polish per OSS guidelines (spacing, padding, hover states, etc.).

---

## Setup Commands

```zsh
pnpm install        # Install dependencies
pnpm dev            # Start development server
pnpm build          # Build the project
pnpm test           # Run tests
pnpm type-check     # Check types
pnpm fix            # Format and lint code
```

---

## Code Style

### General

- Use strict TypeScript with ES modules.
- Omit semicolons unless syntactically required.
- Favor functional programming patterns.
- Use arrow functions by default.
- Sort imports: packages, shared modules, then relative paths.
- Prefer named exports (tree-shaking) over default exports.

### Svelte

- Svelte components: PascalCase filenames, export props via `$props()` rune, keep markup declarative.
- Favor Tailwind utility classes and existing design tokens.
- Create reusable components in `src/client/components` before duplicating markup.

### Server

- Server handlers: Small, pure functions registered on shared `Hono` instance.
- Validate external input using `src/shared/validator.ts` before mutating state.
- Serverless Node.js: all Node globals except `fs`, `http`, `https`, and `net` are available.
- Use `fetch` instead of `http`/`https`.
- File system is read-only; you cannot write files.
- Do not install libraries requiring restricted modules.
- Websockets and HTTP streaming are not supported.
- Redis is accessible via `import { redis } from '@devvit/web/server'`.
- Persist puzzle progress via the `/api/puzzle/progress` routes, which write to Redis keys shaped like `user:{userId}:puzzle:{puzzleId}`; clients must not rely on `localStorage`.

### Shared

- Shared utilities must be framework-agnostic and deterministic; no side-effects. They must be testable from both client and server.
- Colocate Vitest test files next to the module under test (e.g. `generator.test.ts`, `validator.test.ts`). Use lightweight fakes over live services.

### Devvit

Refer to "devvit app" (`/src/devvit`) and "client" (`/src/client`).

> **IMPORTANT:**
> This is a serverless runtime (like AWS Lambda); do not run SQLite or stateful in-memory processes. For real-time use cases, see `devvit_search` docs regarding the real-time service.

---

## Development Workflow

### 1. Explore → Plan → Code → Commit

- Begin with a concise checklist (3–7 bullets) of what you will do; keep items conceptual, not implementation-level.
- Read the code; do not begin coding immediately.
- Plan your approach.
- Ask questions if unclear—do not assume.
- Break tasks into smaller steps.
- Request user approval for your plan before coding.
- Iterate: Review → Approve → Code → Verify → Commit.

### 2. Test-First Workflow (TDD)

- Write failing tests first.
- Implement until tests pass.
- Guard against overfitting.

### 3. Start Development

- Run `pnpm dev` to start development.
- Modify code as needed in client/server/shared.
- Test with `pnpm test`.
- Type-check with `pnpm type-check`.
- Format and lint with `pnpm fix`.

---

## Git Workflows

- Use conventional commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.), limiting the subject to 72 characters. Add context in the body for non-trivial changes.
- Branches: `feat/`, `fix/`, `chore/`, `docs/`
- Use rebase as the default merge method; avoid force-pushing to `main`.
- Commit messages:
  - Start with an imperative verb.
  - Always type-check before committing.
  - Example: `feat(auth): add token validation`

## Repository Etiquette

- Keep commits small and descriptive.
- Update `AGENTS.md` with every new workflow or major tool.
- Never commit secrets or local settings.
- After updates, write a detailed changelog in `CHANGELOG.md`.

> This file is the single source of truth for project workflows, tools, and conventions. Keep it current with every addition or change.
> REMEMBER: After coding you need to update the CHANGELOG.md file with a detailed summary of changes made.

---

## Ultracite Linter and Formatter Rules

### Before Writing Code

1. Analyze codebase patterns
2. Consider edge cases and errors
3. Apply all rules strictly
4. Validate accessibility

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

### Quick Reference

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

### Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### Framework-Specific Guidance

**Svelte:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

### Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

### When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

Most formatting and common issues are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance.
