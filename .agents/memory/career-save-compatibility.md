---
name: Existing Career saves
description: Backward-compatibility requirement for new Career features and fixes.
---

Every Career addition or fix must work for existing save files; do not require players to restart their Career.

**Why:** The user explicitly requires existing saves to remain usable.

**How to apply:** Include an idempotent schema/data migration when needed, preserve historical snapshots and records, and test the feature against a save created under an older version.
