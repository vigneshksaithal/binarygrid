## 2024-05-23 - Array Allocations vs 2D Array Access
**Learning:** In V8, repeatedly accessing elements in a 2D array (`grid[r][c]`) inside a tight loop (like a constraint checker running thousands of times) is significantly slower than allocating a small linear array (`new Array(SIZE)`) once and populating it, even if the allocation happens frequently.
However, the *best* of both worlds is to allocate a reusable buffer *once* at the top level and pass it down. This avoids the GC pressure of frequent allocations AND avoids the overhead of repeated 2D accesses.
I found that replacing a `new Array(6)` per call with direct `grid[r][c]` accesses actually *degraded* performance by ~30x because the repeated optional chaining and property lookups were more expensive than the single allocation + fill.
The winning strategy was to allocate `colBuffer` once in `solvePuzzle` and pass it recursively to `solveFrom` and `canPlaceValue`. This yielded a ~5% speedup over the baseline and eliminates garbage generation in the hot path.

**Action:** When optimizing grid algorithms, prefer passing a reusable "scratchpad" buffer down the call stack over allocating temp arrays or doing repeated 2D lookups in inner loops.
