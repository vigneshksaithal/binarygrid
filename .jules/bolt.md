## 2024-05-23 - Array Allocation in Recursive Solver
**Learning:** In a recursive backtracking solver, allocating small temporary arrays (e.g., `new Array(6)`) inside the hot path (`canPlaceValue`) can be a significant performance bottleneck (30-40% overhead), likely due to garbage collection pressure.
**Action:** Prefer inlining iteration logic or using sliding windows with scalar variables to avoid allocation, even if it makes the code slightly more verbose. Also, be wary of "performance regressions" that are actually correctness bugs causing larger search space traversal.
