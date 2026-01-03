## 2024-05-23 - Solver Optimization
**Learning:** In hot-path recursive functions (like a puzzle solver), allocating even small temporary arrays (e.g., `new Array(6)`) for every step adds significant GC overhead and CPU cost.
**Action:** Replace temporary array allocations with direct iteration over the source data structure (e.g., iterating grid columns directly).
