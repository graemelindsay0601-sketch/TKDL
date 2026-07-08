---
name: Mechanical timeout-leak fix pattern
description: How to safely fix widespread setTimeout leaks across a large file with many similar components, without a full restructure.
---

When a large file (e.g. `scorers.tsx` with 30+ near-identical game-mode components) has dozens of `setTimeout(fn, ms)` calls used as fire-and-forget UI/bot-delay timers with no cleanup, a full manual per-component rewrite is high-risk and slow.

**Approach that worked well:**
1. Add one small reusable hook (`useSafeTimeout()`) that wraps `setTimeout`, tracks IDs in a ref `Set`, and clears any still-pending ones on unmount. It still returns a normal timer ID so any existing manual `clearTimeout(id)` call sites keep working unchanged.
2. Write a short script (via code execution, not by hand) that:
   - Finds each top-level component function boundary (regex on `^export function Name(`).
   - Skips components with zero `setTimeout(` usage.
   - Inserts `const safeTimeout = useSafeTimeout();` right after the function's opening brace (found via paren-depth tracking, since multi-line prop destructuring means the brace isn't on the same line as the signature).
   - Replaces `setTimeout(` → `safeTimeout(` only within that component's line range.
3. Run this bottom-to-top over line ranges so earlier insertions don't shift not-yet-processed indices.

**Why:** blanket sed across the whole file works but can land edits in the wrong place (e.g. inside a multi-line `import { ... }` block) — always verify import insertion separately, and always follow up with a typecheck. This pattern turned ~120 call sites across 26 components into a mechanical, low-risk change with zero manual per-site editing and a clean typecheck.
