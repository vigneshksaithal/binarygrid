## 2024-05-22 - [Optimizing Hot Path Allocations]
**Learning:** The recursive solver's `canPlaceValue` function was allocating a new array for every column check. In backtracking algorithms, this happens millions of times, creating massive GC pressure.
**Action:** Inline column checks using direct grid iteration. Avoid `Array.from` or `new Array` in `canPlaceValue` or similar tight loops. Use `grid[i]![c]` safely when bounds are enforced.
