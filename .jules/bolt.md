## 2024-05-23 - Reusable Array Optimization
**Learning:** In hot recursive paths (like backtracking solvers), allocation of even small temporary arrays (e.g., `new Array(6)`) can add measurable overhead (~12% regression in this case).
**Action:** Use a reusable module-level array for temporary storage if the function is synchronous and single-threaded (e.g. `reusableCol` in `solver.ts`).
**Caution:** This pattern is only safe in single-threaded environments (like Node.js/JS) where the function is synchronous. If the function yields (await), the buffer would be corrupted by interleaved calls.
