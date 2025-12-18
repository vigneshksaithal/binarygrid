## 2025-05-15 - Array Allocation in Recursive Hot Paths
**Learning:** Repeatedly allocating small arrays (like columns extracted from a grid) in a recursive backtracking solver adds up significantly, even if the array size is small (6 elements). Switching to in-place grid access improved performance by ~10%.
**Action:** In backtracking solvers or hot loops involving grids, avoid extracting rows/cols into new arrays. Create helper functions to iterate the grid directly.
