## 2024-05-23 - Avoiding Allocations in Recursive Backtracking
**Learning:** In recursive backtracking algorithms (like our puzzle solver), allocating temporary arrays (e.g., `new Array(SIZE)` for column extraction) in the "hot path" creates significant Garbage Collection pressure.
**Action:** Use direct grid iteration or pass indices to helper functions instead of extracting rows/columns into new arrays.

## 2024-05-23 - Thread Safety of Global Buffers
**Learning:** Using a module-level global variable (e.g., `reusableCol`) for performance optimization in server-side code is dangerous. Hono/Devvit requests may run concurrently in the same process, leading to race conditions where one request overwrites the buffer used by another.
**Action:** Prefer functional patterns (iterating the source directly) or allocate buffers within the function scope/context if strictly necessary. Avoid global mutable state.
