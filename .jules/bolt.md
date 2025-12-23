
## 2025-12-23 - Micro-optimizations in Hot Paths
**Learning:** Even small allocations (like `new Array(6)`) inside a recursive backtracking solver accumulate significant GC pressure and CPU time. Removing them yielded ~13% speedup.
**Action:** Always inspect hot recursive loops for temporary object/array allocations and replace them with direct access or reusable buffers (if thread-safe).

## 2025-12-23 - Formatter Woes
**Learning:** `npx ultracite fix` can be aggressive and modify the whole repo, causing massive diffs that block review.
**Action:** Use targeted formatting or verify diffs carefully before submitting.
