## 2024-05-23 - Global State in Serverless
**Learning:** Global mutable state (like reusable arrays for buffers) must be avoided in server-side code (`src/server`) as they are not thread-safe in the Devvit/Hono environment.
**Action:** Use local variables or pass buffers as arguments. For performance, prefer direct iteration over copying to temporary buffers.
