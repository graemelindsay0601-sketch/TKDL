---
name: Career test isolation
description: Avoid shared mutable save-slot state in live Career API tests.
---

Each live Career API test must create and clean up its own save, and should use a distinct player/slot when multiple active saves are needed. Do not rely on neighboring tests leaving a particular save active or deleting it later.

**Why:** CI shards and filtered test runs execute different subsets and orders; shared slot assumptions created failures that did not reproduce in focused runs.

**How to apply:** When adding or repairing Career integration tests, make setup and teardown self-contained and explicitly verify the owning player for every save-slot request.

The full Career finance test file can exceed the process-isolated API shard's worker limit before reporting results. Running that file with `--test-isolation=none --test-concurrency=1` streams progress and can confirm its assertions independently.

**Why:** The finance tests include expensive season-calendar advances; the parallel shard timed out the file without an assertion failure, while the in-process run completed all 55 tests successfully.

**How to apply:** If the shard reports only a Career finance worker timeout, run the file serially in-process before treating it as a code failure. Keep the aggregate shard timeout visible; an isolated pass does not make that shard run green.
