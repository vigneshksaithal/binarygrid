# Binary Grid

Daily 6×6 binary puzzle for Reddit/Devvit.

## Development

Use Node.js v24.18.0 or newer in the v24 release line and Bun v1.4.3.
Install dependencies with `bun install` and start Reddit playtesting with
`bun run dev`.

Run `bun run test`, `bun run type-check`, `bun run check`, and `bun run build`
before shipping changes. The project compiler is TypeScript 7.0.2, installed
under the `@typescript/native` alias; TypeScript 6.0.3 is also required by
Svelte's checker. The type-check script selects TypeScript 7 explicitly to
avoid the two versions' overlapping executable names.

Keep all four direct Devvit packages pinned to the same version (currently
0.15.0). See the [Devvit changelog](https://developers.reddit.com/docs/changelog)
and [0.15.0 release announcement](https://www.reddit.com/r/Devvit/comments/1xau8ru/release_0150_api_updates_expanded_mode/)
when upgrading.

## Rules

- Each row/col has exactly three 0s and three 1s
- No three consecutive identical digits
- Respect fixed clues
