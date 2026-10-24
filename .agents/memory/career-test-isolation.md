---
name: Career test isolation
description: Avoid shared mutable save-slot state in live Career API tests.
---

Each live Career API test must create and clean up its own save, and should use a distinct player/slot when multiple active saves are needed. Do not rely on neighboring tests leaving a particular save active or deleting it later.

**Why:** CI shards and filtered test runs execute different subsets and orders; shared slot assumptions created failures that did not reproduce in focused runs.

**How to apply:** When adding or repairing Career integration tests, make setup and teardown self-contained and explicitly verify the owning player for every save-slot request.
