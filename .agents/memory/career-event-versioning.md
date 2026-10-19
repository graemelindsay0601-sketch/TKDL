---
name: Career event version compatibility
description: How to handle older serialized event definitions when migrating existing Career saves.
---

Keep historical event-definition rows intact when their stored JSON predates the current TypeScript representation. Do not overwrite or reject those rows during startup sync; require a matching definition hash for the current event database version, and migrate saves forward before generating new events.

**Why:** Existing local Career databases may contain older event snapshots with fewer serialized fields than the current source model. Failing startup on those legitimate historical rows blocks saves from reaching the current calendar.

**How to apply:** When adding a new event database version, preserve existing historical rows and verify with a migration test that old saves advance to the current version without changing their world seed or played history.
