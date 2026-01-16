## 2024-05-23 - [Solver Optimization Logic Inversion]
**Learning:** When inlining a constraint check (like `wouldCreateTripleRun`) into a validator (like `canPlaceValue`), be extremely careful with return values. The constraint check returns `true` if a *violation* exists, while the validator expects `true` if the move is *valid*. I accidentally returned `true` (valid) when a triple run was found, causing the solver to explore invalid paths and degrading performance by 20x due to excessive backtracking/timeouts.
**Action:** Always verify the semantic meaning of return values when refactoring/inlining checks. Add negative test cases if possible to catch false positives.

## 2024-05-23 - [Array Allocation in Recursion]
**Learning:** Removing a `new Array(SIZE)` allocation in the hot path of a recursive solver (depth 36, branching factor 2) improved performance by ~8%. Even small allocations add up in deep recursion.
**Action:** Look for hidden allocations (like `map`, `filter`, or manual array construction) in recursive functions.
