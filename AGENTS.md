# Repository Guidelines

## Project Structure & Module Organization

Binary Grid pairs a Svelte client with a Hono backend and shared logic. Client code lives in `src/client` (interactive UI in `src/client/components`, state stores in `src/client/stores`). Server modules sit in `src/server`; HTTP entry is `src/server/routes.ts` and puzzle helpers live under `src/server/core`. Shared rules, types, and validators are in `src/shared`, with tests colocated such as `src/shared/validator.test.ts` and `src/server/core/generator.test.ts`. Static assets stay in `assets/`, while build outputs target `dist/client` and `dist/server`.

## Build, Test, and Development Commands

- `pnpm install` — install all workspace dependencies.
- `pnpm dev` — run client, server, and Devvit playtest concurrently.
- `pnpm test` — execute the Vitest suite.
- `pnpm type-check` — ensure TS project references compile cleanly.
- `pnpm fix` — run Biome lint autofix and formatting.
- `pnpm check:biome` — lint without modifying files.
- `pnpm build` — emit production bundles into `dist/`.
- `pnpm deploy` / `pnpm launch` — publish the Devvit app.

## Coding Style & Naming Conventions

Use strict TypeScript with ES modules, single quotes, and omit semicolons unless required. Prefer arrow functions and type aliases, and favor small pure helpers in shared code. Svelte 5 components should rely solely on Tailwind utility classes; avoid `<style>` blocks unless a utility gap exists. Name stores descriptively (`game.ts`, `timer.ts`) and keep files PascalCase for components, camelCase for functions, and kebab-case for folders when adding new modules.

## Testing Guidelines

Vitest powers unit coverage. Name specs with the `*.test.ts` suffix beside implementation files to keep context close. Focus on puzzle validation, generation, and API routes; mock Redis interactions using lightweight fakes. Run `pnpm test -- --coverage` before PR submission, and use `pnpm test -- --watch` during active development to keep feedback fast.

## Commit & Pull Request Guidelines

Commits follow conventional prefixes (`feat:`, `fix:`, `chore:`) as shown in the history; keep subjects ≤72 characters and explain notable decisions in the body. Each PR should summarize scope, link related issues, list verification steps (tests, build, type-check), and attach UI screenshots or clips when visual changes occur. Ensure lint, tests, and builds pass locally before requesting review.
