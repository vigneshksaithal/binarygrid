## 2025-05-20 - Global Mutable State in Server
**Learning:** Global reusable arrays (like `reusableCol`) in server-side code (`src/server`) are not thread-safe in the Devvit/Hono environment and can cause data corruption under concurrent load.
**Action:** Replace temporary buffer arrays with direct iteration over the data source (e.g., iterating the grid directly for column checks). This fixes the thread-safety issue and improves performance by eliminating allocation and copy steps.
