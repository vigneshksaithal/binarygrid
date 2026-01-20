# Bolt's Journal

## 2024-05-22 - Solver Allocation Overhead
**Learning:** In the recursive backtracking solver, allocating temporary arrays for column extraction (`new Array(SIZE)`) in the `canPlaceValue` hot path caused significant GC pressure. Direct grid traversal using `grid[i][c]` is faster despite being "less clean" abstractly.
**Action:** For all grid-based constraint checks in hot loops, prefer direct iteration over extraction/allocation.
