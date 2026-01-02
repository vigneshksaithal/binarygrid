## 2024-05-23 - Array Allocation in Hot Paths
**Learning:** In recursive solvers or hot loops, repeatedly allocating small arrays (e.g., `new Array(SIZE)`) adds up to significant GC pressure and performance overhead. Direct iteration over the data structure (like a 2D grid) is often faster and cleaner.
**Action:** Replace `new Array(n)` + `loop` with direct iteration over the source data when checking constraints or aggregating values in performance-critical code.

## 2024-05-23 - Logic Inversion in Generator
**Learning:** When porting logic or refactoring, be extremely careful with boolean conditions. In `canPlace`, returning `true` inside a loop checking for a *violation* (like a triple run) is a critical bug. It should return `false`.
**Action:** Always verify the "base case" and "failure case" logic when modifying constraint checks. Add unit tests that specifically target the constraints being optimized.
