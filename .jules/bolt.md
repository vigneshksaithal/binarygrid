## 2024-05-23 - Array Allocation in Hot Paths
**Learning:** In recursive backtracking solvers (like the one used for puzzles), allocating arrays inside the "hot loop" (e.g., `new Array(SIZE)` inside `canPlaceValue`) can be a significant performance bottleneck due to GC pressure and allocation overhead.
**Action:** Replace temporary array allocations with direct index-based access on the original data structure, especially in functions called thousands of times per second.

## 2024-05-23 - Vitest Benchmarking
**Learning:** Vitest's experimental benchmarking feature (`vitest bench`) is a quick and effective way to measure the impact of micro-optimizations.
**Action:** Always create a temporary benchmark file to verify performance assumptions before and after optimization.
