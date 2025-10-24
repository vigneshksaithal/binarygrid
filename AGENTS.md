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
> - Devvit full documentation is available at `/docs/devvit-docs.txt`.

---

## File Structure

```text
assets/           # Public assets (images, sprites, audio, fonts)
docs/             # Project and Devvit documentation
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

---

## Ultracite Configuration

### Project Context

Ultracite enforces strict type safety, accessibility, and code quality for (JavaScript/TypeScript) using Biome's linter and formatter.

### Key Principles

- Zero configuration required
- Subsecond performance
- Maximum type safety
- AI-friendly code generation

### Before Writing Code

1. Analyze codebase patterns
2. Consider edge cases and errors
3. Apply all rules strictly
4. Validate accessibility

### Rules

#### Accessibility (a11y)

- Don't use `accessKey` attribute on any HTML element.
- Don't set `aria-hidden="true"` on focusable elements.
- Don't add ARIA roles, states, and properties to elements that don't support them.
- Don't use distracting elements like `<marquee>` or `<blink>`.
- Only use the `scope` prop on `<th>` elements.
- Don't assign non-interactive ARIA roles to interactive HTML elements.
- Make sure label elements have text content and are associated with an input.
- Don't assign interactive ARIA roles to non-interactive HTML elements.
- Don't assign `tabIndex` to non-interactive HTML elements.
- Don't use positive integers for `tabIndex` property.
- Don't include "image", "picture", or "photo" in img alt prop.
- Don't use explicit role property that's the same as the implicit/default role.
- Make static elements with click handlers use a valid role attribute.
- Always include a `title` element for SVG elements.
- Give all elements requiring alt text meaningful information for screen readers.
- Make sure anchors have content that's accessible to screen readers.
- Assign `tabIndex` to non-interactive HTML elements with `aria-activedescendant`.
- Include all required ARIA attributes for elements with ARIA roles.
- Make sure ARIA properties are valid for the element's supported roles.
- Always include a `type` attribute for button elements.
- Make elements with interactive roles and handlers focusable.
- Give heading elements content that's accessible to screen readers (not hidden with `aria-hidden`).
- Always include a `lang` attribute on the html element.
- Always include a `title` attribute for iframe elements.
- Accompany `onClick` with at least one of: `onKeyUp`, `onKeyDown`, or `onKeyPress`.
- Accompany `onMouseOver`/`onMouseOut` with `onFocus`/`onBlur`.
- Include caption tracks for audio and video elements.
- Use semantic elements instead of role attributes in JSX.
- Make sure all anchors are valid and navigable.
- Ensure all ARIA properties (`aria-*`) are valid.
- Use valid, non-abstract ARIA roles for elements with ARIA roles.
- Use valid ARIA state and property values.
- Use valid values for the `autocomplete` attribute on input elements.
- Use correct ISO language/country codes for the `lang` attribute.

#### Code Complexity and Quality

- Don't use consecutive spaces in regular expression literals.
- Don't use the `arguments` object.
- Don't use primitive type aliases or misleading types.
- Don't use the comma operator.
- Don't use empty type parameters in type aliases and interfaces.
- Don't write functions that exceed a given Cognitive Complexity score.
- Don't nest describe() blocks too deeply in test files.
- Don't use unnecessary boolean casts.
- Don't use unnecessary callbacks with flatMap.
- Use for...of statements instead of Array.forEach.
- Don't create classes that only have static members (like a static namespace).
- Don't use this and super in static contexts.
- Don't use unnecessary catch clauses.
- Don't use unnecessary constructors.
- Don't use unnecessary continue statements.
- Don't export empty modules that don't change anything.
- Don't use unnecessary escape sequences in regular expression literals.
- Don't use unnecessary fragments.
- Don't use unnecessary labels.
- Don't use unnecessary nested block statements.
- Don't rename imports, exports, and destructured assignments to the same name.
- Don't use unnecessary string or template literal concatenation.
- Don't use String.raw in template literals when there are no escape sequences.
- Don't use useless case statements in switch statements.
- Don't use ternary operators when simpler alternatives exist.
- Don't use useless `this` aliasing.
- Don't use any or unknown as type constraints.
- Don't initialize variables to undefined.
- Don't use the void operators (they're not familiar).
- Use arrow functions instead of function expressions.
- Use Date.now() to get milliseconds since the Unix Epoch.
- Use .flatMap() instead of map().flat() when possible.
- Use literal property access instead of computed property access.
- Don't use parseInt() or Number.parseInt() when binary, octal, or hexadecimal literals work.
- Use concise optional chaining instead of chained logical expressions.
- Use regular expression literals instead of the RegExp constructor when possible.
- Don't use number literal object member names that aren't base 10 or use underscore separators.
- Remove redundant terms from logical expressions.
- Use while loops instead of for loops when you don't need initializer and update expressions.
- Don't pass children as props.
- Don't reassign const variables.
- Don't use constant expressions in conditions.
- Don't use `Math.min` and `Math.max` to clamp values when the result is constant.
- Don't return a value from a constructor.
- Don't use empty character classes in regular expression literals.
- Don't use empty destructuring patterns.
- Don't call global object properties as functions.
- Don't declare functions and vars that are accessible outside their block.
- Make sure builtins are correctly instantiated.
- Don't use super() incorrectly inside classes. Also check that super() is called in classes that extend other constructors.
- Don't use variables and function parameters before they're declared.
- Don't use 8 and 9 escape sequences in string literals.
- Don't use literal numbers that lose precision.

#### Correctness and Safety

- Don't assign a value to itself.
- Don't return a value from a setter.
- Don't compare expressions that modify string case with non-compliant values.
- Don't use lexical declarations in switch clauses.
- Don't use variables that haven't been declared in the document.
- Don't write unreachable code.
- Make sure super() is called exactly once on every code path in a class constructor before this is accessed if the class has a superclass.
- Don't use control flow statements in finally blocks.
- Don't use optional chaining where undefined values aren't allowed.
- Don't have unused function parameters.
- Don't have unused imports.
- Don't have unused labels.
- Don't have unused private class members.
- Don't have unused variables.
- Make sure void (self-closing) elements don't have children.
- Don't return a value from a function with the return type 'void'
- Use isNaN() when checking for NaN.
- Make sure "for" loop update clauses move the counter in the right direction.
- Make sure typeof expressions are compared to valid values.
- Make sure generator functions contain yield.
- Don't use await inside loops.
- Don't use bitwise operators.
- Don't use expressions where the operation doesn't change the value.
- Make sure Promise-like statements are handled appropriately.
- Don't use __dirname and__filename in the global scope.
- Prevent import cycles.
- Don't use configured elements.
- Don't hardcode sensitive data like API keys and tokens.
- Don't let variable declarations shadow variables from outer scopes.
- Don't use the TypeScript directive @ts-ignore.
- Prevent duplicate polyfills from Polyfill.io.
- Don't use useless backreferences in regular expressions that always match empty strings.
- Don't use unnecessary escapes in string literals.
- Don't use useless undefined.
- Make sure getters and setters for the same property are next to each other in class and object definitions.
- Make sure object literals are declared consistently (defaults to explicit definitions).
- Use static Response methods instead of new Response() constructor when possible.
- Make sure switch-case statements are exhaustive.
- Make sure the `preconnect` attribute is used when using Google Fonts.
- Use `Array#{indexOf,lastIndexOf}()` instead of `Array#{findIndex,findLastIndex}()` when looking for the index of an item.
- Make sure iterable callbacks return consistent values.
- Use `with { type: "json" }` for JSON module imports.
- Use numeric separators in numeric literals.
- Use object spread instead of `Object.assign()` when constructing new objects.
- Always use the radix argument when using `parseInt()`.
- Make sure JSDoc comment lines start with a single asterisk, except for the first one.
- Include a description parameter for `Symbol()`.
- Don't use spread (`...`) syntax on accumulators.
- Don't use the `delete` operator.
- Don't access namespace imports dynamically.
- Don't use namespace imports.
- Declare regex literals at the top level.
- Don't use `target="_blank"` without `rel="noopener"`.

#### TypeScript Best Practices

- Don't use TypeScript enums.
- Don't export imported variables.
- Don't add type annotations to variables, parameters, and class properties that are initialized with literal expressions.
- Don't use TypeScript namespaces.
- Don't use non-null assertions with the `!` postfix operator.
- Don't use parameter properties in class constructors.
- Don't use user-defined types.
- Use `as const` instead of literal types and type annotations.
- Use either `T[]` or `Array<T>` consistently.
- Initialize each enum member value explicitly.
- Use `export type` for types.
- Use `import type` for types.
- Make sure all enum members are literal values.
- Don't use TypeScript const enum.
- Don't declare empty interfaces.
- Don't let variables evolve into any type through reassignments.
- Don't use the any type.
- Don't misuse the non-null assertion operator (!) in TypeScript files.
- Don't use implicit any type on variable declarations.
- Don't merge interfaces and classes unsafely.
- Don't use overload signatures that aren't next to each other.
- Use the namespace keyword instead of the module keyword to declare TypeScript namespaces.

#### Style and Consistency

- Don't use global `eval()`.
- Don't use callbacks in asynchronous tests and hooks.
- Don't use negation in `if` statements that have `else` clauses.
- Don't use nested ternary expressions.
- Don't reassign function parameters.
- This rule lets you specify global variable names you don't want to use in your application.
- Don't use specified modules when loaded by import or require.
- Don't use constants whose value is the upper-case version of their name.
- Use `String.slice()` instead of `String.substr()` and `String.substring()`.
- Don't use template literals if you don't need interpolation or special-character handling.
- Don't use `else` blocks when the `if` block breaks early.
- Don't use yoda expressions.
- Don't use Array constructors.
- Use `at()` instead of integer index access.
- Follow curly brace conventions.
- Use `else if` instead of nested `if` statements in `else` clauses.
- Use single `if` statements instead of nested `if` clauses.
- Use `new` for all builtins except `String`, `Number`, and `Boolean`.
- Use consistent accessibility modifiers on class properties and methods.
- Use `const` declarations for variables that are only assigned once.
- Put default function parameters and optional function parameters last.
- Include a `default` clause in switch statements.
- Use the `**` operator instead of `Math.pow`.
- Use `for-of` loops when you need the index to extract an item from the iterated array.
- Use `node:assert/strict` over `node:assert`.
- Use the `node:` protocol for Node.js builtin modules.
- Use Number properties instead of global ones.
- Use assignment operator shorthand where possible.
- Use function types instead of object types with call signatures.
- Use template literals over string concatenation.
- Use `new` when throwing an error.
- Don't throw non-Error values.
- Use `String.trimStart()` and `String.trimEnd()` over `String.trimLeft()` and `String.trimRight()`.
- Use standard constants instead of approximated literals.
- Don't assign values in expressions.
- Don't use async functions as Promise executors.
- Don't reassign exceptions in catch clauses.
- Don't reassign class members.
- Don't compare against -0.
- Don't use labeled statements that aren't loops.
- Don't use void type outside of generic or return types.
- Don't use console.
- Don't use control characters and escape sequences that match control characters in regular expression literals.
- Don't use debugger.
- Don't assign directly to document.cookie.
- Use `===` and `!==`.
- Don't use duplicate case labels.
- Don't use duplicate class members.
- Don't use duplicate conditions in if-else-if chains.
- Don't use two keys with the same name inside objects.
- Don't use duplicate function parameter names.
- Don't have duplicate hooks in describe blocks.
- Don't use empty block statements and static blocks.
- Don't let switch clauses fall through.
- Don't reassign function declarations.
- Don't allow assignments to native objects and read-only global variables.
- Use Number.isFinite instead of global isFinite.
- Use Number.isNaN instead of global isNaN.
- Don't assign to imported bindings.
- Don't use irregular whitespace characters.
- Don't use labels that share a name with a variable.
- Don't use characters made with multiple code points in character class syntax.
- Make sure to use new and constructor properly.
- Don't use shorthand assign when the variable appears on both sides.
- Don't use octal escape sequences in string literals.
- Don't use Object.prototype builtins directly.
- Don't redeclare variables, functions, classes, and types in the same scope.
- Don't have redundant "use strict".
- Don't compare things where both sides are exactly the same.
- Don't let identifiers shadow restricted names.
- Don't use sparse arrays (arrays with holes).
- Don't use template literal placeholder syntax in regular strings.
- Don't use the then property.
- Don't use unsafe negation.
- Don't use var.
- Don't use with statements in non-strict contexts.
- Make sure async functions actually use await.
- Make sure default clauses in switch statements come last.
- Make sure to pass a message value when creating a built-in error.
- Make sure get methods always return a value.
- Use a recommended display strategy with Google Fonts.
- Make sure for-in loops include an if statement.
- Use Array.isArray() instead of instanceof Array.
- Make sure to use the digits argument with Number#toFixed().
- Make sure to use the "use strict" directive in script files.

#### Testing Best Practices

- Don't use export or module.exports in test files.
- Don't use focused tests.
- Make sure the assertion function, like expect, is placed inside an it() function call.
- Don't use disabled tests.

### Common Tasks

- `npx ultracite init`    # Initialize Ultracite
- `npx ultracite fix`    # Auto-format and fix issues
- `npx ultracite check`  # Check for issues

### Example: Error Handling

```typescript
// ✅ Good: Comprehensive error handling
try {
  const result = await fetchData();
  return { success: true, data: result };
} catch (error) {
  console.error('API call failed:', error);
  return { success: false, error: error.message };
}

// ❌ Bad: Swallowing errors
try {
  return await fetchData();
} catch (e) {
  console.log(e);
}
```
