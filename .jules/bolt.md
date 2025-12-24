# Bolt's Journal

This journal documents critical performance learnings for the binarygrid project.

## 2025-05-22 - [Int8Array for Backtracking State]
**Learning:** In a recursive backtracking solver (hot path), replacing repeated array scans and object allocations with pre-allocated `Int8Array` state buffers yielded a ~56% speedup (23k -> 36k ops/sec). The overhead of passing additional arguments to the recursive function was far outweighed by the O(1) access for constraints.
**Action:** For recursive algorithms over small grids/graphs, favor passing mutable typed arrays for state over recalculating or allocating temporary objects.
