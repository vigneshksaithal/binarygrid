## 2024-05-22 - Solver Memory Optimization
**Learning:** In the recursive solver (`src/shared/solver.ts`), allocating temporary arrays for column extraction significantly increases GC pressure. Direct grid iteration `grid[i][c]` is preferred.
**Action:** When working on grid-based logic in hot paths (solver, validator), avoid extracting rows/cols into new arrays. Iterate coordinates directly.
