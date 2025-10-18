# Repository Guidelines

## Agent Workflow Expectations
- Consider yourself a senior software engineer: think deeply about each problem before touching the code.
- Plan the solution before implementation, choosing the minimal set of changes required.
- Favor modular, simple, and easily understandable code; write only the necessary code to achieve the functionality.

## Project Overview & Key Entry Points
- **Client (Svelte 5)** lives under `src/client`. `App.svelte` mounts the UI while `main.ts` hydrates the client via Vite. Components are colocated in `src/client/components` and must rely on runes (`$props`, `$derived`, `$state`) rather than the legacy Svelte syntax. Shared styling is in `app.css` with Tailwind utility classes; avoid `<style>` blocks except for truly missing utilities. Color tokens live in `colors.css` and should be referenced via CSS variables.
- **State management** for the UI is handled with Svelte stores under `src/client/stores` (`game.ts`, `timer.ts`, `ui.ts`, `theme.ts`, and streak helpers). Prefer derived stores and pure helpers; make stores tree-shakeable by exporting factory functions when appropriate.
- **Server (Hono)** code sits in `src/server`. `routes.ts` wires REST endpoints consumed by the client and Devvit runtime, `index.ts` is the web entry. Core puzzle logic (generation, post metadata) lives under `src/server/core`.
- **Shared logic** resides in `src/shared`. This directory exposes rule helpers (`rules.ts`), validation (`validator.ts`), solver utilities (`solver.ts`), streak helpers (`streak.ts`), and shared types under `src/shared/types`. Keep server and client imports pointed at these modules to avoid duplication.
- **TypeScript project references** inherit from `tools/tsconfig-base.json`; update the base config first when changing compiler options, then extend within each package-specific `tsconfig.json` (`src/client/tsconfig.json`, `src/server/tsconfig.json`, `src/shared/tsconfig.json`).
- **Assets** for branding and puzzles belong in `assets/`; distribution artifacts go to `dist/client` and `dist/server` after builds. Generated files should not be committed unless explicitly required.

## Coding Style & Implementation Notes
- Use strict TypeScript with ES modules. Omit semicolons unless syntactically required. Keep imports sorted by package, shared modules, then relative paths. Avoid default exports; prefer named exports for tree-shaking.
- Svelte components must be PascalCase filenames, export props via the `$props()` rune, and keep markup declarative. Favor Tailwind utility classes and existing design tokens; create reusable components in `src/client/components` before duplicating markup.
- Server handlers should be small pure functions registered on the shared `Hono` instance. Validate external input with `src/shared/validator.ts` helpers before mutating state. Redis access occurs through `@devvit/web/server` `redis`; encapsulate key formats via helper functions to prevent drift.
- Shared utilities should remain framework-agnostic. Write deterministic, side-effect-free functions wherever possible so they can be exercised from both client and server tests.
- When adding tests, colocate Vitest files using the `*.test.ts` suffix next to the module under test (`streak.test.ts`, `generator.test.ts`, `validator.test.ts`). Use lightweight fakes instead of hitting live services.

## Build, Test, and Quality Gates
- Install dependencies with `pnpm install`.
- Development server: `pnpm dev` (runs Svelte client, Hono server, and Devvit playtest concurrently).
- Run unit tests with `pnpm test`; add `-- --coverage` before opening a PR.
- Type-check all packages using `pnpm type-check`.
- Lint and format with Biome via `pnpm fix` (autofix) or `pnpm check:biome` (read-only).
- Build production bundles using `pnpm build`. Use `pnpm deploy` / `pnpm launch` for Devvit publishing when applicable.

## Contribution Workflow & Best Practices
- Follow conventional commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.) with subjects ≤ 72 characters. Include context in the body when non-trivial decisions are made.
- Before submitting a PR, ensure linting, tests, builds, and type-checks pass locally. Provide screenshots for visual changes (Svelte components) using the prescribed tooling.
- Keep diffs focused; prefer small, incremental commits. Document new utilities or architectural decisions in code comments or module docstrings when clarity is needed.
- When introducing new modules, update this file if the project structure or conventions change so future contributors stay aligned.
